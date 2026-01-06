import express from 'express';
import { scrapeRedditPost, estimateReadingDuration, truncateForDuration } from '../services/reddit.service.js';

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
    
    // Truncate content to fit 60 second limit
    const truncatedContent = truncateForDuration(post.content, 55); // Leave 5s buffer for title
    const estimatedDuration = estimateReadingDuration(post.title + ' ' + truncatedContent);

    return res.json({
      success: true,
      data: {
        title: post.title,
        author: post.author,
        content: truncatedContent,
        subreddit: post.subreddit,
        originalUrl: post.url,
        estimatedDuration: Math.min(estimatedDuration, 60),
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

export default video;
