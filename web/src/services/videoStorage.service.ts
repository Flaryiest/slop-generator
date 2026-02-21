/**
 * Video Storage Service
 * 
 * Persists generated videos and their metadata to IndexedDB.
 * Supports CRUD operations with blob storage for the actual MP4 data.
 */

const DB_NAME = 'reely-db';
const DB_VERSION = 1;
const VIDEO_STORE = 'videos';
const THUMBNAIL_STORE = 'thumbnails';

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  redditUrl: string;
  duration: number;       // seconds
  fileSize: number;       // bytes
  createdAt: number;      // epoch ms
  tags: string[];         // derived from subreddit, etc.
}

export interface StoredVideo {
  metadata: VideoMetadata;
  blob: Blob;
  thumbnailBlob?: Blob;
}

/**
 * Open (or create) the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: 'id' });
        videoStore.createIndex('createdAt', 'createdAt', { unique: false });
        videoStore.createIndex('title', 'title', { unique: false });
        videoStore.createIndex('subreddit', 'subreddit', { unique: false });
        videoStore.createIndex('duration', 'duration', { unique: false });
      }

      if (!db.objectStoreNames.contains(THUMBNAIL_STORE)) {
        db.createObjectStore(THUMBNAIL_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a unique ID for a video entry.
 */
function generateId(): string {
  return `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a thumbnail from a video blob by rendering the first frame to a canvas.
 */
async function generateThumbnail(videoBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadeddata', () => {
      // Seek to 1 second for a more representative frame
      video.currentTime = Math.min(1, video.duration * 0.1);
    });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      // Thumbnail at reduced resolution
      canvas.width = 180;
      canvas.height = 320;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate thumbnail'));
        },
        'image/webp',
        0.7
      );
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video for thumbnail'));
    });

    video.load();
  });
}

/**
 * Save a video with its metadata to IndexedDB.
 */
export async function saveVideo(
  blob: Blob,
  metadata: Omit<VideoMetadata, 'id' | 'createdAt' | 'fileSize'>
): Promise<VideoMetadata> {
  const db = await openDB();
  const id = generateId();
  const now = Date.now();

  const fullMetadata: VideoMetadata = {
    ...metadata,
    id,
    createdAt: now,
    fileSize: blob.size,
  };

  // Generate thumbnail
  let thumbnailBlob: Blob | undefined;
  try {
    thumbnailBlob = await generateThumbnail(blob);
  } catch (e) {
    console.warn('Thumbnail generation failed:', e);
  }

  return new Promise((resolve, reject) => {
    const storeNames = [VIDEO_STORE, THUMBNAIL_STORE];
    const tx = db.transaction(storeNames, 'readwrite');
    const videoStore = tx.objectStore(VIDEO_STORE);
    const thumbStore = tx.objectStore(THUMBNAIL_STORE);

    // Store metadata + blob together
    videoStore.put({ ...fullMetadata, blob });

    if (thumbnailBlob) {
      thumbStore.put({ id, blob: thumbnailBlob });
    }

    tx.oncomplete = () => {
      db.close();
      resolve(fullMetadata);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve all video metadata (without blobs for efficiency).
 */
export async function getAllVideoMetadata(): Promise<VideoMetadata[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const store = tx.objectStore(VIDEO_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ blob, ...metadata }: { blob: Blob } & VideoMetadata) => metadata
      );
      db.close();
      resolve(results);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Retrieve a single video blob by ID.
 */
export async function getVideoBlob(id: string): Promise<Blob | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const store = tx.objectStore(VIDEO_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      db.close();
      resolve(request.result?.blob ?? null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Retrieve a thumbnail blob by video ID.
 */
export async function getThumbnailBlob(id: string): Promise<Blob | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(THUMBNAIL_STORE, 'readonly');
    const store = tx.objectStore(THUMBNAIL_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      db.close();
      resolve(request.result?.blob ?? null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete a video and its thumbnail by ID.
 */
export async function deleteVideo(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([VIDEO_STORE, THUMBNAIL_STORE], 'readwrite');
    tx.objectStore(VIDEO_STORE).delete(id);
    tx.objectStore(THUMBNAIL_STORE).delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get total storage usage in bytes.
 */
export async function getStorageUsage(): Promise<number> {
  const allMeta = await getAllVideoMetadata();
  return allMeta.reduce((sum, v) => sum + v.fileSize, 0);
}
