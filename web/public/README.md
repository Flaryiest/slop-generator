# Background Video Setup

This folder should contain the background video for your Reddit Reel generator.

## Required File

Place a video file named `background.mp4` in this folder.

### Recommendations:
- **Format**: MP4 (H.264 codec)
- **Aspect Ratio**: Any (will be cropped to 9:16)
- **Duration**: At least 60 seconds (will loop if shorter)
- **Resolution**: 1080p or higher recommended

### Suggested Content:
- Minecraft parkour gameplay
- Subway Surfers gameplay
- Satisfying videos (slime, sand cutting, etc.)
- Abstract/gradient animations
- Nature footage

### Free Sources:
1. **Pexels**: https://www.pexels.com/videos/
2. **Pixabay**: https://pixabay.com/videos/
3. **Coverr**: https://coverr.co/

### Quick Download Command (example):
```bash
# Download a sample video from Pexels (you'll need to find the direct link)
curl -o background.mp4 "YOUR_VIDEO_URL"
```

### Note:
The video will be:
- Scaled to fill 1080x1920 (9:16)
- Looped to match audio duration
- Overlaid with subtitles
