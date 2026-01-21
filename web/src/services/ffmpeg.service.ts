import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let loaded = false;

export interface VideoProgress {
  progress: number;
  message: string;
}

export type ProgressCallback = (progress: VideoProgress) => void;

export interface SubtitleEntry {
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Initialize and load FFmpeg (multi-threaded version for better performance)
 */
export async function loadFFmpeg(onProgress?: ProgressCallback): Promise<FFmpeg> {
  if (ffmpeg && loaded) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();
  
  // Use multi-threaded ESM build for better performance
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.10/dist/esm';
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.({
      progress: 40 + Math.round(progress * 50), // Map to 40-90% range
      message: `Processing video: ${Math.round(progress * 100)}%`
    });
  });

  onProgress?.({ progress: 0, message: 'Loading FFmpeg (this may take a moment)...' });

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  loaded = true;
  onProgress?.({ progress: 10, message: 'FFmpeg loaded' });
  
  return ffmpeg;
}

// Local font file in public folder
const FONT_URL = '/Roboto-Bold.ttf';

/**
 * Convert seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
function toSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Generate SRT subtitle content from subtitle entries
 */
function generateSrtContent(entries: SubtitleEntry[]): string {
  return entries.map((entry, index) => {
    const startTime = toSrtTimestamp(entry.startTime);
    const endTime = toSrtTimestamp(entry.endTime);
    return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`;
  }).join('\n');
}

/**
 * Generate ASS subtitle content with styling (better control than SRT)
 */
function generateAssContent(entries: SubtitleEntry[]): string {
  // ASS header with style definition
  const header = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Roboto,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,2,20,20,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Convert entries to ASS dialogue lines
  const dialogues = entries.map((entry) => {
    const start = toAssTimestamp(entry.startTime);
    const end = toAssTimestamp(entry.endTime);
    // ASS uses different escaping - just escape backslashes and curly braces
    const text = entry.text
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}');
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + dialogues;
}

/**
 * Convert seconds to ASS timestamp format (H:MM:SS.cc)
 */
function toAssTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.round((seconds % 1) * 100);
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

/**
 * Generate a video with audio and subtitles using ASS subtitle file
 */
export async function generateVideo(
  backgroundVideoUrl: string,
  audioBlob: Blob,
  subtitleEntries: SubtitleEntry[],
  audioDuration: number,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const ff = await loadFFmpeg(onProgress);
  
  onProgress?.({ progress: 15, message: 'Loading assets...' });
  
  // Load font file for subtitles
  const fontData = await fetchFile(FONT_URL);
  
  // Copy font data before first use since writeFile transfers (detaches) the buffer
  const fontDataCopy = new Uint8Array(fontData);
  
  await ff.writeFile('font.ttf', fontData);
  
  // Create fonts directory and copy font there for ASS to find
  try {
    await ff.createDir('fonts');
  } catch {
    // Directory might already exist
  }
  await ff.writeFile('fonts/Roboto.ttf', fontDataCopy);
  
  onProgress?.({ progress: 20, message: 'Loading background video...' });
  
  // Write background video to FFmpeg virtual filesystem
  const videoData = await fetchFile(backgroundVideoUrl);
  await ff.writeFile('background.mp4', videoData);
  
  onProgress?.({ progress: 30, message: 'Loading audio...' });
  
  // Write audio file (Piper outputs WAV format)
  const audioArrayBuffer = await audioBlob.arrayBuffer();
  const audioData = new Uint8Array(audioArrayBuffer);
  await ff.writeFile('audio.wav', audioData);
  
  // Generate and write ASS subtitle file
  onProgress?.({ progress: 35, message: 'Generating subtitles...' });
  const assContent = generateAssContent(subtitleEntries);
  const encoder = new TextEncoder();
  await ff.writeFile('subtitles.ass', encoder.encode(assContent));
  
  onProgress?.({ progress: 40, message: 'Compositing video (this takes ~1-2 min)...' });
  
  // Calculate video duration (cap at 2 minutes)
  const duration = Math.min(audioDuration, 120);
  
  // Video filter: scale, crop, then burn in subtitles using ASS file
  const videoFilters = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24,ass=subtitles.ass:fontsdir=fonts";
  
  // FFmpeg command optimized for SPEED in WebAssembly
  await ff.exec([
    '-stream_loop', '-1',           // Loop video indefinitely
    '-i', 'background.mp4',          // Input video
    '-i', 'audio.wav',               // Input audio (WAV from Piper TTS)
    '-vf', videoFilters,
    '-map', '0:v:0',                 // Map video from first input
    '-map', '1:a:0',                 // Map audio from second input
    '-c:v', 'libx264',               // Video codec
    '-preset', 'ultrafast',          // FASTEST encoding
    '-tune', 'fastdecode',           // Optimize for fast decoding too
    '-crf', '28',                    // Lower quality = faster (28 is still decent)
    '-c:a', 'aac',                   // Audio codec
    '-b:a', '128k',                  // Audio bitrate
    '-t', String(duration),          // Duration limit
    '-movflags', '+faststart',       // Enable fast start for web playback
    '-y',                            // Overwrite output
    'output.mp4'
  ]);
  
  onProgress?.({ progress: 90, message: 'Finalizing video...' });
  
  // Read the output file and immediately copy to avoid detached ArrayBuffer issues
  const outputData = await ff.readFile('output.mp4') as Uint8Array;
  
  // Create a copy immediately before any cleanup that might detach the buffer
  const videoCopy = new Uint8Array(outputData.length);
  videoCopy.set(outputData);
  
  // Cleanup virtual filesystem
  try {
    await ff.deleteFile('font.ttf');
    await ff.deleteFile('fonts/Roboto.ttf');
    await ff.deleteFile('background.mp4');
    await ff.deleteFile('audio.wav');
    await ff.deleteFile('subtitles.ass');
    await ff.deleteFile('output.mp4');
  } catch (e) {
    console.warn('Cleanup warning:', e);
  }
  
  onProgress?.({ progress: 100, message: 'Video complete!' });
  
  return new Blob([videoCopy], { type: 'video/mp4' });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
