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
 * Generate a video with audio and subtitles using drawtext filter
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
  await ff.writeFile('font.ttf', fontData);
  
  onProgress?.({ progress: 20, message: 'Loading background video...' });
  
  // Write background video to FFmpeg virtual filesystem
  const videoData = await fetchFile(backgroundVideoUrl);
  await ff.writeFile('background.mp4', videoData);
  
  onProgress?.({ progress: 30, message: 'Loading audio...' });
  
  // Write audio file
  const audioData = new Uint8Array(await audioBlob.arrayBuffer());
  await ff.writeFile('audio.mp3', audioData);
  
  onProgress?.({ progress: 40, message: 'Compositing video (this takes ~1-2 min)...' });
  
  // Calculate video duration (cap at 60 seconds)
  const duration = Math.min(audioDuration, 60);
  
  // Build drawtext filter chain for subtitles
  // Each subtitle gets its own drawtext filter with enable condition
  const drawtextFilters = subtitleEntries.map((entry) => {
    // Escape text for ffmpeg filter (escape quotes, colons, backslashes)
    const escapedText = entry.text
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/%/g, '\\%');
    
    return `drawtext=fontfile=font.ttf:text='${escapedText}':fontsize=42:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-200:enable='between(t\\,${entry.startTime.toFixed(2)}\\,${entry.endTime.toFixed(2)})'`;
  });
  
  // Combine all filters
  const videoFilters = [
    'scale=720:1280:force_original_aspect_ratio=increase',
    'crop=720:1280',
    'fps=24',
    ...drawtextFilters
  ].join(',');
  
  // FFmpeg command optimized for SPEED in WebAssembly
  await ff.exec([
    '-stream_loop', '-1',           // Loop video indefinitely
    '-i', 'background.mp4',          // Input video
    '-i', 'audio.mp3',               // Input audio
    '-vf', videoFilters,
    '-c:v', 'libx264',               // Video codec
    '-preset', 'ultrafast',          // FASTEST encoding
    '-tune', 'fastdecode',           // Optimize for fast decoding too
    '-crf', '28',                    // Lower quality = faster (28 is still decent)
    '-c:a', 'aac',                   // Audio codec
    '-b:a', '96k',                   // Lower audio bitrate
    '-t', String(duration),          // Duration limit
    '-shortest',                     // End when shortest input ends
    '-movflags', '+faststart',       // Enable fast start for web playback
    '-y',                            // Overwrite output
    'output.mp4'
  ]);
  
  onProgress?.({ progress: 90, message: 'Finalizing video...' });
  
  // Read the output file
  const outputData = await ff.readFile('output.mp4') as Uint8Array;
  
  // Cleanup virtual filesystem
  try {
    await ff.deleteFile('font.ttf');
    await ff.deleteFile('background.mp4');
    await ff.deleteFile('audio.mp3');
    await ff.deleteFile('output.mp4');
  } catch (e) {
    console.warn('Cleanup warning:', e);
  }
  
  onProgress?.({ progress: 100, message: 'Video complete!' });
  
  // Convert to regular ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(outputData.byteLength);
  new Uint8Array(buffer).set(outputData);
  
  return new Blob([buffer], { type: 'video/mp4' });
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
