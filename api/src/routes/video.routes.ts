import express from 'express';
import { scrapeRedditPost, estimateReadingDuration, truncateForDuration } from '../services/reddit.service.js';
import { generateSpeech, generateWordTimings } from '../services/tts.service.js';

const video = express.Router();

/**
 * POST /video/scrape
 * Scrapes a Reddit post and returns the content
 */
video.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const post = await scrapeRedditPost(url);
    
    // Truncate content to fit 2 minute limit
    const truncatedContent = truncateForDuration(post.content, 115); // Leave 5s buffer for title
    const estimatedDuration = estimateReadingDuration(post.title + ' ' + truncatedContent);

    return res.json({
      success: true,
      data: {
        title: post.title,
        author: post.author,
        content: truncatedContent,
        subreddit: post.subreddit,
        originalUrl: post.url,
        estimatedDuration: Math.min(estimatedDuration, 120),
        wasTruncated: truncatedContent !== post.content
      }
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to scrape Reddit post' 
    });
  }
});

/**
 * GET /video/test
 * Test endpoint
 */
video.get('/test', (req, res) => {
  res.json({ message: 'Video API is working' });
});

/**
 * POST /video/tts
 * Generate text-to-speech audio using Piper
 */
video.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
    }

    console.log('Generating TTS for text:', text.substring(0, 100) + '...');
    
    const { audioBuffer, duration } = await generateSpeech(text);
    const wordTimings = generateWordTimings(text, duration);

    // Return audio as base64 with metadata
    return res.json({
      success: true,
      data: {
        audio: audioBuffer.toString('base64'),
        duration,
        wordTimings,
        format: 'wav'
      }
    });
  } catch (error) {
    console.error('TTS error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate speech' 
    });
  }
});

export default video;
