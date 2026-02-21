/**
 * Search & Filter Service
 * 
 * Implements:
 * 
 * 1. **Trie (Prefix Tree)** — For efficient prefix-based title/subreddit search.
 *    Each node stores a map of children and a set of video IDs that match.
 *    Supports O(m) prefix lookup where m = query length, returning all
 *    matching IDs by traversing the subtree.
 * 
 * 2. **Binary Search** — For date range filtering on a sorted array.
 *    Uses lower_bound / upper_bound style searches to efficiently
 *    find videos within a time range in O(log n).
 * 
 * 3. **Multi-field filtering** — Combines results from different filters
 *    using set intersection for AND semantics.
 */

import type { VideoMetadata } from '@/services/videoStorage.service';

// ─── Trie for prefix search ─────────────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  videoIds: Set<string>;  // IDs of videos that have a word starting with this prefix
}

function createTrieNode(): TrieNode {
  return {
    children: new Map(),
    videoIds: new Set(),
  };
}

/**
 * A Trie (prefix tree) that indexes video titles and subreddits
 * for fast prefix-based autocomplete search.
 * 
 * Each word from a video's title/subreddit is inserted character by character.
 * At every node along the path, the video's ID is stored, so a prefix query
 * can collect all videos matching that prefix by looking at a single node.
 */
export class SearchTrie {
  private root: TrieNode = createTrieNode();

  /**
   * Insert a video's searchable text into the trie.
   * Tokenizes by whitespace and indexes each word.
   */
  insert(videoId: string, text: string): void {
    const words = this.tokenize(text);

    for (const word of words) {
      let node = this.root;
      for (const char of word) {
        if (!node.children.has(char)) {
          node.children.set(char, createTrieNode());
        }
        node = node.children.get(char)!;
        // Every prefix of this word maps to this video
        node.videoIds.add(videoId);
      }
    }
  }

  /**
   * Search for all video IDs matching a prefix query.
   * The query is also tokenized — ALL query tokens must match (AND semantics).
   * 
   * Time: O(m) per token to traverse + O(k) to collect IDs at the node,
   * where m = token length, k = number of matching IDs.
   */
  search(query: string): Set<string> {
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return new Set();

    let result: Set<string> | null = null;

    for (const token of tokens) {
      const ids = this.prefixSearch(token);
      if (result === null) {
        result = ids;
      } else {
        // Intersection: video must match ALL tokens
        result = setIntersection(result, ids);
      }
    }

    return result ?? new Set();
  }

  /**
   * Find all video IDs where any indexed word starts with the given prefix.
   */
  private prefixSearch(prefix: string): Set<string> {
    let node = this.root;

    for (const char of prefix) {
      if (!node.children.has(char)) {
        return new Set(); // No matches
      }
      node = node.children.get(char)!;
    }

    // All IDs at this node have a word matching this prefix
    return new Set(node.videoIds);
  }

  /**
   * Tokenize text: lowercase, split on non-alphanumeric, filter empty.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Clear and rebuild the trie from a fresh set of videos.
   */
  rebuild(videos: VideoMetadata[]): void {
    this.root = createTrieNode();
    for (const video of videos) {
      const searchText = `${video.title} ${video.subreddit} ${video.author}`;
      this.insert(video.id, searchText);
    }
  }
}

// ─── Set operations ──────────────────────────────────────────────────────────

function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  // Iterate over the smaller set for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of smaller) {
    if (larger.has(item)) {
      result.add(item);
    }
  }
  return result;
}

// ─── Binary Search for date range filtering ──────────────────────────────────

/**
 * Lower bound: find the index of the first element where keyFn(element) >= target.
 * Array must be sorted by keyFn in ascending order.
 * 
 * Classic binary search variant — O(log n).
 */
function lowerBound<T>(arr: T[], target: number, keyFn: (item: T) => number): number {
  let lo = 0;
  let hi = arr.length;

  while (lo < hi) {
    const mid = lo + ((hi - lo) >>> 1); // Avoid overflow with unsigned right shift
    if (keyFn(arr[mid]) < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Upper bound: find the index of the first element where keyFn(element) > target.
 * Array must be sorted by keyFn in ascending order.
 * 
 * O(log n).
 */
function upperBound<T>(arr: T[], target: number, keyFn: (item: T) => number): number {
  let lo = 0;
  let hi = arr.length;

  while (lo < hi) {
    const mid = lo + ((hi - lo) >>> 1);
    if (keyFn(arr[mid]) <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Find all videos within a date range [startMs, endMs] using binary search.
 * 
 * Requires the input array to be sorted by createdAt ascending.
 * Returns the slice of matching elements in O(log n + k) where k = result count.
 */
export function filterByDateRange(
  sortedVideos: VideoMetadata[],
  startMs: number,
  endMs: number
): VideoMetadata[] {
  const lo = lowerBound(sortedVideos, startMs, (v) => v.createdAt);
  const hi = upperBound(sortedVideos, endMs, (v) => v.createdAt);
  return sortedVideos.slice(lo, hi);
}

// ─── Duration range filter ───────────────────────────────────────────────────

export function filterByDurationRange(
  videos: VideoMetadata[],
  minSeconds: number,
  maxSeconds: number
): VideoMetadata[] {
  return videos.filter((v) => v.duration >= minSeconds && v.duration <= maxSeconds);
}

// ─── Subreddit filter ────────────────────────────────────────────────────────

export function filterBySubreddit(
  videos: VideoMetadata[],
  subreddit: string
): VideoMetadata[] {
  const target = subreddit.toLowerCase();
  return videos.filter((v) => v.subreddit.toLowerCase() === target);
}

// ─── Combined filter pipeline ────────────────────────────────────────────────

export interface FilterConfig {
  searchQuery?: string;
  subreddit?: string;
  dateRange?: { start: number; end: number };
  durationRange?: { min: number; max: number };
}

/**
 * Apply all active filters to a video list.
 * 
 * - Text search uses the Trie for O(m) prefix matching
 * - Date range uses binary search on a sorted copy for O(log n)
 * - Other filters use linear scans
 * - Results are intersected using ID sets
 */
export function applyFilters(
  videos: VideoMetadata[],
  filters: FilterConfig,
  trie: SearchTrie
): VideoMetadata[] {
  let candidates = videos;

  // 1. Text search via Trie
  if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
    const matchingIds = trie.search(filters.searchQuery);
    candidates = candidates.filter((v) => matchingIds.has(v.id));
  }

  // 2. Subreddit exact match
  if (filters.subreddit && filters.subreddit.trim().length > 0) {
    candidates = filterBySubreddit(candidates, filters.subreddit);
  }

  // 3. Date range via binary search (sort a copy by createdAt first)
  if (filters.dateRange) {
    const sorted = [...candidates].sort((a, b) => a.createdAt - b.createdAt);
    candidates = filterByDateRange(sorted, filters.dateRange.start, filters.dateRange.end);
  }

  // 4. Duration range
  if (filters.durationRange) {
    candidates = filterByDurationRange(
      candidates,
      filters.durationRange.min,
      filters.durationRange.max
    );
  }

  return candidates;
}

/**
 * Extract unique subreddits from the video list for filter dropdown.
 */
export function getUniqueSubreddits(videos: VideoMetadata[]): string[] {
  const subs = new Set(videos.map((v) => v.subreddit));
  return Array.from(subs).sort((a, b) => a.localeCompare(b));
}
