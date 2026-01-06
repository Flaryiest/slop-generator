const API_URL = 'http://localhost:8080';

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
 * Generate speech from text using Piper TTS backend
 * Returns the audio blob and word timings for subtitles
 */
export async function generateSpeech(text: string): Promise<TTSResult> {
  const response = await fetch(`${API_URL}/video/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to generate speech');
  }

  const result = await response.json();
  const { audio, duration, wordTimings, format } = result.data;

  // Convert base64 audio to Blob
  const binaryString = atob(audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  const audioBlob = new Blob([bytes], { type: mimeType });

  return {
    audioBlob,
    duration,
    wordTimings,
  };
}

/**
 * Get actual duration of an audio blob
 */
export async function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error('Failed to load audio'));
    };
  });
}
