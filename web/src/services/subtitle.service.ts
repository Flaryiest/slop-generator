import { WordTiming } from './tts.service';
import { SubtitleEntry } from './ffmpeg.service';

/**
 * Generates subtitle entries for drawtext filter
 * Each entry has text, start time, and end time
 */
export function generateSubtitleEntries(
  title: string,
  author: string,
  _content: string,
  wordTimings: WordTiming[]
): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  
  // Add title (first 3 seconds)
  entries.push({
    text: title.substring(0, 50) + (title.length > 50 ? '...' : ''), // Truncate long titles
    startTime: 0,
    endTime: 3
  });
  
  // Add author (1-3 seconds) - separate line
  entries.push({
    text: `u/${author}`,
    startTime: 1,
    endTime: 3
  });
  
  // Offset for content (after title display)
  const contentOffset = 3.0;
  
  // Group words into phrases (3-5 words each) for subtitle display
  const phrases = groupWordsIntoPhrases(wordTimings, 4);
  
  phrases.forEach((phrase) => {
    entries.push({
      text: phrase.words.join(' '),
      startTime: phrase.startTime + contentOffset,
      endTime: phrase.endTime + contentOffset
    });
  });
  
  return entries;
}

interface Phrase {
  words: string[];
  startTime: number;
  endTime: number;
}

/**
 * Groups words into phrases for better readability
 */
function groupWordsIntoPhrases(wordTimings: WordTiming[], wordsPerPhrase: number): Phrase[] {
  const phrases: Phrase[] = [];
  
  for (let i = 0; i < wordTimings.length; i += wordsPerPhrase) {
    const phraseWords = wordTimings.slice(i, i + wordsPerPhrase);
    
    if (phraseWords.length === 0) continue;
    
    phrases.push({
      words: phraseWords.map(w => w.word),
      startTime: phraseWords[0].startTime,
      endTime: phraseWords[phraseWords.length - 1].endTime
    });
  }
  
  return phrases;
}

/**
 * Generate word timings from text when TTS timings aren't available
 */
export function estimateWordTimings(text: string, totalDuration: number): WordTiming[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const timings: WordTiming[] = [];
  
  // Calculate time per word
  const timePerWord = totalDuration / words.length;
  
  words.forEach((word, index) => {
    timings.push({
      word,
      startTime: index * timePerWord,
      endTime: (index + 1) * timePerWord
    });
  });
  
  return timings;
}
