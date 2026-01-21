import { useNavigate } from 'react-router-dom';
import styles from './index.module.css';

export default function IndexPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Slop Generator</h1>
        <p className={styles.subtitle}>
          Transform Reddit stories into viral Instagram Reels in seconds
        </p>
        
        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}></span>
            <h3>Paste Reddit Link</h3>
            <p>Just paste any Reddit post URL</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}></span>
            <h3>Auto Narration</h3>
            <p>Text-to-speech reads the story</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}></span>
            <h3>Ready for Reels</h3>
            <p>9:16 format with subtitles</p>
          </div>
        </div>

        <button 
          className={styles.ctaButton}
          onClick={() => navigate('/generate')}
        >
          Start Generating
        </button>
      </div>
    </div>
  );
}