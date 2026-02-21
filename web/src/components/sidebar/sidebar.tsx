/**
 * Video Library Sidebar
 * 
 * Displays saved videos with search, filter, and sort controls.
 * Uses Trie-based search, merge sort / introsort / radix sort depending on field.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './sidebar.module.css';
import {
  getAllVideoMetadata,
  getVideoBlob,
  getThumbnailBlob,
  deleteVideo,
  type VideoMetadata,
} from '@/services/videoStorage.service';
import {
  sortVideos,
  getSortAlgorithmName,
  type SortField,
  type SortDirection,
  type SortConfig,
} from '@/services/sorting.service';
import {
  SearchTrie,
  applyFilters,
  getUniqueSubreddits,
  type FilterConfig,
} from '@/services/search.service';
import { downloadBlob } from '@/services/ffmpeg.service';

interface SidebarProps {
  onVideoSelect?: (blob: Blob, metadata: VideoMetadata) => void;
  refreshTrigger?: number; // increment to trigger a reload
}

export default function Sidebar({ onVideoSelect, refreshTrigger }: SidebarProps) {
  const [videos, setVideos] = useState<VideoMetadata[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<VideoMetadata[]>([]);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Trie instance (persists across renders)
  const trieRef = useRef(new SearchTrie());

  // Available subreddits for filter dropdown
  const subreddits = useMemo(() => getUniqueSubreddits(videos), [videos]);

  // Load all videos from IndexedDB
  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const allMeta = await getAllVideoMetadata();
      setVideos(allMeta);

      // Rebuild the trie index
      trieRef.current.rebuild(allMeta);

      // Load thumbnails
      const thumbMap = new Map<string, string>();
      await Promise.all(
        allMeta.map(async (v) => {
          const thumbBlob = await getThumbnailBlob(v.id);
          if (thumbBlob) {
            thumbMap.set(v.id, URL.createObjectURL(thumbBlob));
          }
        })
      );
      setThumbnails((prev) => {
        // Revoke old URLs
        prev.forEach((url) => URL.revokeObjectURL(url));
        return thumbMap;
      });
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount and when refreshTrigger changes
  useEffect(() => {
    loadVideos();
  }, [loadVideos, refreshTrigger]);

  // Clean up thumbnail URLs on unmount
  useEffect(() => {
    return () => {
      thumbnails.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters + sorting whenever inputs change
  useEffect(() => {
    const filters: FilterConfig = {};
    if (searchQuery.trim()) filters.searchQuery = searchQuery;
    if (selectedSubreddit) filters.subreddit = selectedSubreddit;

    const filtered = applyFilters(videos, filters, trieRef.current);

    const sortConfig: SortConfig = { field: sortField, direction: sortDirection };
    const sorted = sortVideos(filtered, sortConfig);

    setFilteredVideos(sorted);
  }, [videos, searchQuery, selectedSubreddit, sortField, sortDirection]);

  // Handlers
  const handleVideoClick = async (metadata: VideoMetadata) => {
    if (!onVideoSelect) return;
    const blob = await getVideoBlob(metadata.id);
    if (blob) {
      onVideoSelect(blob, metadata);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this video?')) return;
    await deleteVideo(id);
    // Revoke thumbnail URL
    const thumbUrl = thumbnails.get(id);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    loadVideos();
  };

  const handleDownload = async (e: React.MouseEvent, metadata: VideoMetadata) => {
    e.stopPropagation();
    const blob = await getVideoBlob(metadata.id);
    if (blob) {
      const filename = `reddit-reel-${metadata.subreddit}-${metadata.id}.mp4`;
      downloadBlob(blob, filename);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (epochMs: number): string => {
    return new Date(epochMs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isCollapsed) {
    return (
      <div className={styles.collapsedSidebar}>
        <button
          className={styles.expandButton}
          onClick={() => setIsCollapsed(false)}
          title="Show video library"
        >
          <span className={styles.expandIcon}>▶</span>
          <span className={styles.expandBadge}>{videos.length}</span>
        </button>
      </div>
    );
  }

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>Video Library</h2>
        <div className={styles.headerActions}>
          <span className={styles.videoCount}>{filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}</span>
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(true)}
            title="Collapse sidebar"
          >
            ◀
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchBox}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search titles, subreddits..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          title="Toggle filters"
        >
          ⚙
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          {/* Subreddit filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Subreddit</label>
            <select
              className={styles.filterSelect}
              value={selectedSubreddit}
              onChange={(e) => setSelectedSubreddit(e.target.value)}
            >
              <option value="">All</option>
              {subreddits.map((sub) => (
                <option key={sub} value={sub}>
                  r/{sub}
                </option>
              ))}
            </select>
          </div>

          {/* Sort controls */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort by</label>
            <div className={styles.sortControls}>
              <select
                className={styles.filterSelect}
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
              >
                <option value="createdAt">Date Created</option>
                <option value="title">Title</option>
                <option value="duration">Duration</option>
                <option value="fileSize">File Size</option>
                <option value="subreddit">Subreddit</option>
              </select>
              <button
                className={styles.sortDirectionButton}
                onClick={toggleSortDirection}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Algorithm info */}
          <div className={styles.algorithmInfo}>
            Algorithm: {getSortAlgorithmName(sortField)}
          </div>

          {/* Clear filters */}
          <button
            className={styles.clearFilters}
            onClick={() => {
              setSearchQuery('');
              setSelectedSubreddit('');
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Video list */}
      <div className={styles.videoList}>
        {isLoading && (
          <div className={styles.emptyState}>Loading...</div>
        )}

        {!isLoading && filteredVideos.length === 0 && videos.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎬</div>
            <p>No videos yet</p>
            <p className={styles.emptyHint}>Generated videos will appear here</p>
          </div>
        )}

        {!isLoading && filteredVideos.length === 0 && videos.length > 0 && (
          <div className={styles.emptyState}>
            <p>No videos match your filters</p>
            <button
              className={styles.clearFilters}
              onClick={() => {
                setSearchQuery('');
                setSelectedSubreddit('');
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {filteredVideos.map((video) => (
          <div
            key={video.id}
            className={styles.videoCard}
            onClick={() => handleVideoClick(video)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleVideoClick(video)}
          >
            {/* Thumbnail */}
            <div className={styles.thumbnailWrapper}>
              {thumbnails.has(video.id) ? (
                <img
                  src={thumbnails.get(video.id)}
                  alt={video.title}
                  className={styles.thumbnail}
                />
              ) : (
                <div className={styles.thumbnailPlaceholder}>▶</div>
              )}
              <span className={styles.durationBadge}>
                {formatDuration(video.duration)}
              </span>
            </div>

            {/* Info */}
            <div className={styles.videoInfo}>
              <h4 className={styles.videoTitle} title={video.title}>
                {video.title}
              </h4>
              <div className={styles.videoMeta}>
                <span>r/{video.subreddit}</span>
                <span>·</span>
                <span>{formatDate(video.createdAt)}</span>
              </div>
              <div className={styles.videoMeta}>
                <span>{formatSize(video.fileSize)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.videoActions}>
              <button
                className={styles.actionButton}
                onClick={(e) => handleDownload(e, video)}
                title="Download"
              >
                ⬇
              </button>
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={(e) => handleDelete(e, video.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
