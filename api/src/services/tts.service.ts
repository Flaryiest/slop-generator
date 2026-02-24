import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Piper executable and model
// In Electron production builds, PIPER_DIR_OVERRIDE points to the bundled piper
const PIPER_DIR = process.env.PIPER_DIR_OVERRIDE || path.join(__dirname, '../../piper/piper');
const PIPER_EXE = path.join(PIPER_DIR, 'piper.exe');
const VOICE_MODEL = path.join(PIPER_DIR, 'en_US-lessac-medium.onnx');

export interface TTSResult {
  audioBuffer: Buffer;
  duration: number;
}

/**
 * Estimate audio duration based on text (words per minute)
 * Piper's lessac voice speaks at roughly 150-180 WPM
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const wpm = 160; // Average for this voice
  return (words / wpm) * 60;
}

/**
 * Generate speech audio from text using Piper TTS
 */
export async function generateSpeech(text: string): Promise<TTSResult> {
  // Create temp file for output
  const tempDir = os.tmpdir();
  const outputFile = path.join(tempDir, `piper-${crypto.randomUUID()}.wav`);
  
  return new Promise((resolve, reject) => {
    const args = [
      '--model', VOICE_MODEL,
      '--output_file', outputFile,
    ];

    const piper = spawn(PIPER_EXE, args, {
      cwd: PIPER_DIR, // Important: run from piper dir so it finds DLLs
    });

    let stderr = '';

    // Send text to stdin
    piper.stdin.write(text);
    piper.stdin.end();

    piper.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    piper.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`Piper exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Read the generated audio file
        const audioBuffer = await fs.readFile(outputFile);
        
        // Clean up temp file
        await fs.unlink(outputFile).catch(() => {});
        
        // Calculate duration from WAV header (or estimate)
        const duration = estimateDuration(text);
        
        resolve({
          audioBuffer,
          duration,
        });
      } catch (err) {
        reject(err);
      }
    });

    piper.on('error', (err) => {
      reject(new Error(`Failed to start Piper: ${err.message}`));
    });
  });
}

/**
 * Generate word-level timing estimates
 * Note: Piper doesn't provide native word timing, so we estimate
 */
export function generateWordTimings(text: string, totalDuration: number): Array<{ word: string; startTime: number; endTime: number }> {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const timings: Array<{ word: string; startTime: number; endTime: number }> = [];
  
  if (words.length === 0) return timings;
  
  // Distribute time roughly equally, with slight variation for word length
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  let currentTime = 0;
  
  for (const word of words) {
    // Weight duration by character count (longer words take longer to say)
    const wordDuration = (word.length / totalChars) * totalDuration;
    
    timings.push({
      word,
      startTime: currentTime,
      endTime: currentTime + wordDuration,
    });
    
    currentTime += wordDuration;
  }
  
  return timings;
}
