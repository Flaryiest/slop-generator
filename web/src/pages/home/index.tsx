import { useNavigate } from 'react-router-dom';
import styles from './index.module.css';
import { LinkIcon, MicrophoneIcon, FilmIcon, SparklesIcon } from '@/components/icons/Icons';

export default function IndexPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.logoMark}>
          <SparklesIcon size={32} color="var(--rose-400)" />
        </div>
        <h1 className={styles.title}>Reely</h1>
        <p className={styles.subtitle}>
          Transform Reddit stories into polished Instagram Reels — instantly
        </p>
        
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIconWrapper}>
              <LinkIcon size={28} color="var(--rose-400)" />
            </div>
            <h3>Paste a Link</h3>
            <p>Drop any Reddit post URL and we handle the rest</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIconWrapper}>
              <MicrophoneIcon size={28} color="var(--rose-400)" />
            </div>
            <h3>Auto Narration</h3>
            <p>Natural text-to-speech brings the story to life</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIconWrapper}>
              <FilmIcon size={28} color="var(--rose-400)" />
            </div>
            <h3>Reel-Ready</h3>
            <p>9:16 vertical video with synced subtitles</p>
          </div>
        </div>

        <button 
          className={styles.ctaButton}
          onClick={() => navigate('/generate')}
        >
          Start Creating
        </button>
      </div>
    </div>
  );
}