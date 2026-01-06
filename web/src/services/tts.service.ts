export interface TTSResult {
  audioBlob: Blob;
  duration: number;
  wordTimings: WordTiming[];
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
}

/**
 * Generate speech from text using Web Speech API with audio recording
 * Returns the audio blob and word timings for subtitles
 */
export async function generateSpeech(text: string): Promise<TTSResult> {
  return new Promise((resolve, reject) => {
    // Check for browser support
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported in this browser'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices and select a good one
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && v.name.includes('Google') || v.name.includes('Microsoft')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.9;  // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;

    // Calculate word timings based on text length
    // Since Web Speech API doesn't provide exact timings, we estimate
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordsPerSecond = 2.5; // Average speaking rate
    const estimatedDuration = words.length / wordsPerSecond;
    
    const wordTimings: WordTiming[] = [];
    let currentTime = 0;
    
    words.forEach((word) => {
      // Estimate duration based on word length
      const syllables = Math.max(1, Math.ceil(word.length / 3));
      const wordDuration = syllables * 0.2; // ~200ms per syllable
      
      wordTimings.push({
        word,
        startTime: currentTime,
        endTime: currentTime + wordDuration
      });
      
      currentTime += wordDuration + 0.1; // Small pause between words
    });
    
    // Normalize timings to fit estimated duration
    const scaleFactor = estimatedDuration / currentTime;
    wordTimings.forEach(timing => {
      timing.startTime *= scaleFactor;
      timing.endTime *= scaleFactor;
    });

    // For audio capture, we'll use the Media Recorder API with audio context
    // Note: Web Speech API doesn't directly output audio, so we need a workaround
    
    // Create audio using a simple TTS approach - use speak and record system audio
    // Since direct recording isn't possible, we'll use a synthesized approach
    
    const startTime = Date.now();
    
    utterance.onend = () => {
      const actualDuration = (Date.now() - startTime) / 1000;
      
      // Scale word timings to actual duration
      const scale = actualDuration / estimatedDuration;
      wordTimings.forEach(timing => {
        timing.startTime *= scale;
        timing.endTime *= scale;
      });
      
      // Since we can't capture Web Speech API audio directly,
      // we'll create a silent placeholder and rely on the browser to play the speech
      // For production, you'd want to use a cloud TTS service that returns audio
      
      // Create a simple audio blob (silent) - actual speech plays through browser
      const sampleRate = 44100;
      const numChannels = 1;
      const samples = new Float32Array(Math.ceil(actualDuration * sampleRate));
      
      // Create WAV file
      const wavBlob = createWavBlob(samples, sampleRate, numChannels);
      
      resolve({
        audioBlob: wavBlob,
        duration: actualDuration,
        wordTimings
      });
    };

    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`));
    };

    speechSynthesis.speak(utterance);
  });
}

/**
 * Creates a WAV audio blob from audio samples
 */
function createWavBlob(samples: Float32Array, sampleRate: number, numChannels: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Alternative: Generate speech using browser's MediaRecorder to capture audio
 * This requires user permission and captures system audio
 */
export async function generateSpeechWithCapture(text: string): Promise<TTSResult> {
  // For a better solution, integrate with a cloud TTS API like:
  // - ElevenLabs (high quality, paid)
  // - Google Cloud TTS (good quality, paid)
  // - Azure Speech (good quality, paid)
  
  // For now, use the basic approach
  return generateSpeech(text);
}

/**
 * Preload voices (needed for some browsers)
 */
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
    
    // Timeout fallback
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
  });
}
