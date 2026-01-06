export interface RedditPost {
  title: string;
  author: string;
  content: string;
  subreddit: string;
  url: string;
}

/**
 * Extracts Reddit post data from a Reddit URL
 * Works by appending .json to the URL to get the JSON API response
 */
export async function scrapeRedditPost(url: string): Promise<RedditPost> {
  // Validate URL is a Reddit URL
  const redditUrlPattern = /^https?:\/\/(www\.)?(reddit\.com|old\.reddit\.com)\/r\/\w+\/comments\/\w+/;
  if (!redditUrlPattern.test(url)) {
    throw new Error('Invalid Reddit URL. Please provide a valid Reddit post URL.');
  }

  // Clean the URL and append .json
  let cleanUrl = url.split('?')[0]; // Remove query params
  if (!cleanUrl.endsWith('/')) {
    cleanUrl += '/';
  }
  const jsonUrl = cleanUrl + '.json';

  try {
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Reddit post: ${response.status}`);
    }

    const data = await response.json();
    
    // Reddit API returns an array: [post data, comments]
    const postData = data[0]?.data?.children?.[0]?.data;
    
    if (!postData) {
      throw new Error('Could not parse Reddit post data');
    }

    // Get the post content - selftext for text posts
    let content = postData.selftext || '';
    
    // If it's a link post with no selftext, note that
    if (!content && postData.url && !postData.is_self) {
      content = `[Link Post: ${postData.url}]`;
    }

    // Decode HTML entities in the content
    content = decodeHtmlEntities(content);

    return {
      title: decodeHtmlEntities(postData.title || 'Untitled'),
      author: postData.author || 'Unknown',
      content: content,
      subreddit: postData.subreddit || '',
      url: url
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to scrape Reddit post: ${error.message}`);
    }
    throw new Error('Failed to scrape Reddit post: Unknown error');
  }
}

/**
 * Decodes HTML entities commonly found in Reddit content
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&#x200B;': '', // Zero-width space
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Also handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

/**
 * Estimates the reading duration of text in seconds
 * Average reading speed: ~150 words per minute for clear narration
 */
export function estimateReadingDuration(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const wordsPerSecond = 150 / 60; // 2.5 words per second
  return Math.ceil(words / wordsPerSecond);
}

/**
 * Truncates content to fit within a maximum duration (60 seconds)
 */
export function truncateForDuration(content: string, maxSeconds: number = 60): string {
  const wordsPerSecond = 150 / 60;
  const maxWords = Math.floor(maxSeconds * wordsPerSecond);
  
  const words = content.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length <= maxWords) {
    return content;
  }

  // Truncate and add ellipsis
  return words.slice(0, maxWords).join(' ') + '...';
}
