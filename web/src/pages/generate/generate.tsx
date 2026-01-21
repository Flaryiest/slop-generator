import { useState, useRef, useEffect } from 'react';
import styles from './generate.module.css';
import { loadFFmpeg, generateVideo, downloadBlob, VideoProgress } from '@/services/ffmpeg.service';
import { generateSpeech, TTSResult } from '@/services/tts.service';
import { generateSubtitleEntries, estimateWordTimings } from '@/services/subtitle.service';

interface RedditData {
  title: string;
  author: string;
  content: string;
  subreddit: string;
  estimatedDuration: number;
  wasTruncated: boolean;
}

type Step = 'input' | 'preview' | 'generating' | 'complete';

export default function GeneratePage() {
  const [url, setUrl] = useState('');
  const [redditData, setRedditData] = useState<RedditData | null>(null);
  const [step, setStep] = useState<Step>('input');
  const [progress, setProgress] = useState<VideoProgress>({ progress: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Clean up video URL when component unmounts or video changes
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Fetch Reddit post data
  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a Reddit URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8080/video/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch Reddit post');
      }

      setRedditData(result.data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate the video
  const handleGenerate = async () => {
    if (!redditData) return;

    setStep('generating');
    setError(null);
    setProgress({ progress: 0, message: 'Initializing...' });

    try {
      // Generate the full text for narration
      const fullText = `${redditData.title}. Posted by ${redditData.author}. ${redditData.content}`;
      
      // Generate speech (this will give us timing info)
      setProgress({ progress: 10, message: 'Generating speech...' });
      
      let ttsResult: TTSResult;
      try {
        ttsResult = await generateSpeech(fullText);
      } catch {
        // Fallback: estimate timings
        const estimatedDuration = redditData.estimatedDuration;
        const wordTimings = estimateWordTimings(fullText, estimatedDuration);
        ttsResult = {
          audioBlob: new Blob(), // Empty blob as placeholder
          duration: estimatedDuration,
          wordTimings
        };
      }

      setProgress({ progress: 20, message: 'Generating subtitles...' });

      // Generate subtitle entries for drawtext filter
      const subtitleEntries = generateSubtitleEntries(
        redditData.title,
        redditData.author,
        redditData.content,
        ttsResult.wordTimings
      );

      setProgress({ progress: 30, message: 'Loading FFmpeg...' });

      // Load FFmpeg
      await loadFFmpeg((p) => setProgress(p));

      // Use default background video
      const backgroundUrl = '/background.mp4';

      setProgress({ progress: 40, message: 'Creating video...' });

      // Generate video
      const generatedBlob = await generateVideo(
        backgroundUrl,
        ttsResult.audioBlob,
        subtitleEntries,
        ttsResult.duration,
        (p) => setProgress(p)
      );

      // Create object URL for preview
      const url = URL.createObjectURL(generatedBlob);
      
      setVideoBlob(generatedBlob);
      setVideoUrl(url);
      setStep('complete');

      // Set video preview after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.load();
        }
      }, 100);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setStep('preview');
    }
  };

  // Download the video
  const handleDownload = () => {
    if (!videoBlob || !redditData) return;
    
    const filename = `reddit-reel-${redditData.subreddit}-${Date.now()}.mp4`;
    downloadBlob(videoBlob, filename);
  };

  // Reset to start
  const handleReset = () => {
    // Clean up old video URL
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setUrl('');
    setRedditData(null);
    setStep('input');
    setProgress({ progress: 0, message: '' });
    setError(null);
    setVideoBlob(null);
    setVideoUrl(null);
    if (videoRef.current) {
      videoRef.current.src = '';
    }
  };

  const getStepStatus = (s: Step) => {
    const order: Step[] = ['input', 'preview', 'generating', 'complete'];
    const currentIndex = order.indexOf(step);
    const stepIndex = order.indexOf(s);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return '';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Reddit Reel Generator</h1>
        <p>Transform Reddit stories into viral Instagram Reels</p>
      </header>

      <div className={styles.steps}>
        <div className={`${styles.step} ${styles[getStepStatus('input')]}`}>
          <div className={styles.stepNumber}>1</div>
          <span className={styles.stepLabel}>Enter URL</span>
        </div>
        <div className={`${styles.step} ${styles[getStepStatus('preview')]}`}>
          <div className={styles.stepNumber}>2</div>
          <span className={styles.stepLabel}>Preview</span>
        </div>
        <div className={`${styles.step} ${styles[getStepStatus('generating')]}`}>
          <div className={styles.stepNumber}>3</div>
          <span className={styles.stepLabel}>Generate</span>
        </div>
        <div className={`${styles.step} ${styles[getStepStatus('complete')]}`}>
          <div className={styles.stepNumber}>4</div>
          <span className={styles.stepLabel}>Download</span>
        </div>
      </div>

      <div className={styles.card}>
        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            <div className={styles.inputGroup}>
              <input
                type="text"
                className={styles.input}
                placeholder="Paste Reddit post URL here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              />
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleScrape}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Fetch Post'}
              </button>
            </div>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Example: https://reddit.com/r/tifu/comments/abc123/...
            </p>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && redditData && (
          <>
            <div className={styles.preview}>
              <h3>{redditData.title}</h3>
              <p>Posted by u/{redditData.author} in r/{redditData.subreddit}</p>
              
              <div className={styles.previewMeta}>
                <span>~{redditData.estimatedDuration}s</span>
                {redditData.wasTruncated && (
                  <span>Content truncated to fit 60s</span>
                )}
              </div>

              <div className={styles.previewContent}>
                {redditData.content || <em>No text content</em>}
              </div>
            </div>

            <div className={styles.warning}>
              Note: The browser's text-to-speech will narrate the content. For the best experience, ensure your speakers are on.
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.secondaryButton}`}
                onClick={() => setStep('input')}
              >
                Back
              </button>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleGenerate}
              >
                Generate Video
              </button>
            </div>
          </>
        )}

        {/* Step 3: Generating */}
        {step === 'generating' && (
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <p className={styles.progressText}>{progress.message}</p>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && videoUrl && (
          <>
            <div className={styles.videoPreview}>
              <video
                ref={videoRef}
                className={styles.video}
                controls
                playsInline
                style={{ maxHeight: '70vh', aspectRatio: '9/16' }}
                src={videoUrl}
              />
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.secondaryButton}`}
                onClick={handleReset}
              >
                Create Another
              </button>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={handleDownload}
              >
                Download Video
              </button>
            </div>
          </>
        )}

        {/* Error display */}
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
