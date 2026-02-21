/**
 * Sorting Service
 * 
 * Implements non-trivial, well-known sorting algorithms for educational complexity:
 * 
 * 1. **Merge Sort** — Stable O(n log n) used for lexicographic title sorting.
 *    Guarantees stability so equal-title videos retain their insertion order.
 * 
 * 2. **Introsort** — Hybrid algorithm (Quicksort + Heapsort + Insertion Sort).
 *    Used by C++ STL std::sort. Starts with quicksort (fast in practice),
 *    falls back to heapsort when recursion depth exceeds 2*floor(log2(n))
 *    to guarantee O(n log n) worst case, and switches to insertion sort
 *    for small partitions (≤16 elements) for cache efficiency.
 *    Used for duration sorting.
 * 
 * 3. **Radix Sort (LSD)** — O(nk) non-comparison sort for integer keys.
 *    Used for date-based sorting on epoch timestamps.
 *    Processes digits from least significant to most significant using
 *    counting sort as a stable subroutine.
 */

import type { VideoMetadata } from '@/services/videoStorage.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SortField = 'title' | 'createdAt' | 'duration' | 'fileSize' | 'subreddit';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// ─── Merge Sort (Stable, for lexicographic sorting) ──────────────────────────

/**
 * Top-down merge sort. Stable O(n log n).
 * Used for lexicographic (title, subreddit) sorting where stability matters.
 */
function mergeSort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);

  return merge(left, right, compare);
}

function merge<T>(left: T[], right: T[], compare: (a: T, b: T) => number): T[] {
  const result: T[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    // <= 0 ensures stability: equal elements from left come first
    if (compare(left[i], right[j]) <= 0) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  return result;
}

// ─── Introsort (Quicksort + Heapsort + Insertion Sort hybrid) ────────────────

const INSERTION_SORT_THRESHOLD = 16;

/**
 * Introsort: hybrid sorting algorithm.
 * - Quicksort with median-of-three pivot selection
 * - Falls back to heapsort when depth limit exceeded
 * - Switches to insertion sort for small partitions
 * 
 * Guarantees O(n log n) worst case with excellent average-case performance.
 */
function introsort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  const result = [...arr];
  if (result.length <= 1) return result;

  const maxDepth = 2 * Math.floor(Math.log2(result.length));
  introsortImpl(result, 0, result.length - 1, maxDepth, compare);
  return result;
}

function introsortImpl<T>(
  arr: T[],
  lo: number,
  hi: number,
  depthLimit: number,
  compare: (a: T, b: T) => number
): void {
  const size = hi - lo + 1;

  // Small partition: use insertion sort (cache-friendly for small arrays)
  if (size <= INSERTION_SORT_THRESHOLD) {
    insertionSort(arr, lo, hi, compare);
    return;
  }

  // Depth limit reached: fall back to heapsort to guarantee O(n log n)
  if (depthLimit === 0) {
    heapsort(arr, lo, hi, compare);
    return;
  }

  // Quicksort with median-of-three pivot selection
  const pivot = medianOfThree(arr, lo, lo + Math.floor(size / 2), hi, compare);
  const [lt, gt] = threeWayPartition(arr, lo, hi, pivot, compare);

  introsortImpl(arr, lo, lt - 1, depthLimit - 1, compare);
  introsortImpl(arr, gt + 1, hi, depthLimit - 1, compare);
}

/**
 * Insertion sort — optimal for small arrays and nearly-sorted data.
 */
function insertionSort<T>(
  arr: T[],
  lo: number,
  hi: number,
  compare: (a: T, b: T) => number
): void {
  for (let i = lo + 1; i <= hi; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= lo && compare(arr[j], key) > 0) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

/**
 * Heapsort — in-place, O(n log n) guaranteed, used as fallback.
 * Operates on a subarray [lo..hi].
 */
function heapsort<T>(
  arr: T[],
  lo: number,
  hi: number,
  compare: (a: T, b: T) => number
): void {
  const n = hi - lo + 1;

  // Build max-heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(arr, lo, i, n, compare);
  }

  // Extract elements from heap one by one
  for (let i = n - 1; i > 0; i--) {
    // Swap root (maximum) with last element
    [arr[lo], arr[lo + i]] = [arr[lo + i], arr[lo]];
    siftDown(arr, lo, 0, i, compare);
  }
}

function siftDown<T>(
  arr: T[],
  lo: number,
  i: number,
  heapSize: number,
  compare: (a: T, b: T) => number
): void {
  let largest = i;

  while (true) {
    const left = 2 * largest + 1;
    const right = 2 * largest + 2;
    let next = largest;

    if (left < heapSize && compare(arr[lo + left], arr[lo + next]) > 0) {
      next = left;
    }
    if (right < heapSize && compare(arr[lo + right], arr[lo + next]) > 0) {
      next = right;
    }

    if (next === largest) break;

    [arr[lo + largest], arr[lo + next]] = [arr[lo + next], arr[lo + largest]];
    largest = next;
  }
}

/**
 * Median-of-three pivot selection — reduces chance of worst-case quicksort.
 */
function medianOfThree<T>(
  arr: T[],
  a: number,
  b: number,
  c: number,
  compare: (a: T, b: T) => number
): T {
  if (compare(arr[a], arr[b]) > 0) [arr[a], arr[b]] = [arr[b], arr[a]];
  if (compare(arr[a], arr[c]) > 0) [arr[a], arr[c]] = [arr[c], arr[a]];
  if (compare(arr[b], arr[c]) > 0) [arr[b], arr[c]] = [arr[c], arr[b]];
  return arr[b];
}

/**
 * Three-way partitioning (Dutch National Flag algorithm by Dijkstra).
 * Partitions array into three regions: [< pivot, == pivot, > pivot].
 * Handles duplicate keys efficiently.
 * 
 * Returns [lt, gt] where:
 *   arr[lo..lt-1]  < pivot
 *   arr[lt..gt]   == pivot
 *   arr[gt+1..hi]  > pivot
 */
function threeWayPartition<T>(
  arr: T[],
  lo: number,
  hi: number,
  pivot: T,
  compare: (a: T, b: T) => number
): [number, number] {
  let lt = lo;
  let i = lo;
  let gt = hi;

  while (i <= gt) {
    const cmp = compare(arr[i], pivot);
    if (cmp < 0) {
      [arr[lt], arr[i]] = [arr[i], arr[lt]];
      lt++;
      i++;
    } else if (cmp > 0) {
      [arr[i], arr[gt]] = [arr[gt], arr[i]];
      gt--;
    } else {
      i++;
    }
  }

  return [lt, gt];
}

// ─── Radix Sort (LSD, for integer-keyed sorting like timestamps) ─────────────

/**
 * LSD Radix Sort using base-256 (byte-level) counting sort.
 * O(nk) where k = number of bytes in the key (8 for a 64-bit timestamp).
 * 
 * Operates on numeric keys extracted from objects.
 * Non-comparison-based: sorts by examining individual digits/bytes.
 */
function radixSort<T>(arr: T[], keyFn: (item: T) => number): T[] {
  if (arr.length <= 1) return [...arr];

  const n = arr.length;
  let items = [...arr];

  // We use base-256 radix sort on the integer key.
  // JavaScript numbers are 64-bit floats, but our timestamps and sizes
  // fit in 48-bit integers (safe integer range). We process 6 bytes.
  const NUM_BYTES = 6;
  const BASE = 256;

  for (let byte = 0; byte < NUM_BYTES; byte++) {
    // Counting sort on current byte (LSD first)
    const count = new Array<number>(BASE).fill(0);
    const output = new Array<T>(n);

    // Count occurrences
    for (let i = 0; i < n; i++) {
      const key = keyFn(items[i]);
      const digit = (key >>> (byte * 8)) & 0xFF;
      count[digit]++;
    }

    // Compute prefix sums (cumulative counts)
    for (let i = 1; i < BASE; i++) {
      count[i] += count[i - 1];
    }

    // Build output array (iterate backwards for stability)
    for (let i = n - 1; i >= 0; i--) {
      const key = keyFn(items[i]);
      const digit = (key >>> (byte * 8)) & 0xFF;
      count[digit]--;
      output[count[digit]] = items[i];
    }

    items = output;
  }

  return items;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sort videos by the given field and direction using the appropriate algorithm.
 * 
 * Algorithm selection:
 *   - title, subreddit → Merge Sort (stable, lexicographic)
 *   - createdAt, fileSize → Radix Sort (non-comparison, optimal for integers)
 *   - duration → Introsort (hybrid, demonstrates advanced partitioning)
 */
export function sortVideos(
  videos: VideoMetadata[],
  config: SortConfig
): VideoMetadata[] {
  if (videos.length <= 1) return [...videos];

  const { field, direction } = config;
  let sorted: VideoMetadata[];

  switch (field) {
    case 'title':
    case 'subreddit': {
      // Merge sort for stable lexicographic ordering
      const compare = (a: VideoMetadata, b: VideoMetadata): number =>
        a[field].localeCompare(b[field], 'en', { sensitivity: 'base' });
      sorted = mergeSort(videos, compare);
      break;
    }

    case 'createdAt':
    case 'fileSize': {
      // Radix sort for integer keys (timestamps, byte counts)
      sorted = radixSort(videos, (v) => v[field]);
      break;
    }

    case 'duration': {
      // Introsort (quicksort + heapsort + insertion sort hybrid)
      const compare = (a: VideoMetadata, b: VideoMetadata): number =>
        a.duration - b.duration;
      sorted = introsort(videos, compare);
      break;
    }

    default:
      sorted = [...videos];
  }

  if (direction === 'desc') {
    sorted.reverse();
  }

  return sorted;
}

/**
 * Get a human-readable description of which algorithm is being used.
 */
export function getSortAlgorithmName(field: SortField): string {
  switch (field) {
    case 'title':
    case 'subreddit':
      return 'Merge Sort (stable, O(n log n))';
    case 'createdAt':
    case 'fileSize':
      return 'Radix Sort (LSD base-256, O(nk))';
    case 'duration':
      return 'Introsort (QS + Heap + Insertion, O(n log n))';
    default:
      return 'Default';
  }
}
