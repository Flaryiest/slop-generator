# 🎬 Slop Generator

Transform Reddit stories into viral Instagram Reels automatically.

## Features

- 📖 **Reddit Scraping**: Paste any Reddit post URL to extract the story
- 🎙️ **Auto Narration**: Text-to-speech reads the story aloud
- 📝 **Dynamic Subtitles**: Word-by-word subtitles synced with speech
- 📱 **Reel-Ready**: 9:16 vertical format perfect for Instagram/TikTok
- ⏱️ **60s Limit**: Automatically truncates content to fit Reels format
- 🖥️ **Browser-Based**: All video processing happens in your browser (no server needed for FFmpeg)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript |
| Video Processing | ffmpeg.wasm (WebAssembly) |
| TTS | Web Speech API |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- A background video file (see below)

### 1. Clone and Install

```bash
git clone https://github.com/ericm/slop-generator.git
cd slop-generator

# Install API dependencies
cd api
npm install

# Install Web dependencies
cd ../web
npm install
```

### 2. Configure Database

```bash
cd api

# Create .env file
echo "DATABASE_URL=postgresql://user:password@localhost:5432/slop_generator" > .env

# Run migrations
npx prisma migrate dev
```

### 3. Add Background Video

Place a video file at `web/public/background.mp4`. 

Recommended sources:
- [Pexels](https://www.pexels.com/videos/) (free stock videos)
- [Pixabay](https://pixabay.com/videos/)

Popular choices: Minecraft parkour, Subway Surfers, satisfying videos.

### 4. Start Development

```bash
# Terminal 1 - API
cd api
npm run dev

# Terminal 2 - Web
cd web
npm run dev
```

Visit http://localhost:5173

## Usage

1. Go to the Generate page
2. Paste a Reddit post URL (e.g., `https://reddit.com/r/tifu/comments/...`)
3. Preview the extracted content
4. Click "Generate Video"
5. Wait for processing (30-60 seconds)
6. Download your reel!

## Project Structure

```
slop-generator/
├── api/                    # Backend API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── video.routes.ts   # Video generation endpoints
│   │   │   └── auth.routes.ts    # Authentication
│   │   ├── services/
│   │   │   └── reddit.service.ts # Reddit scraping
│   │   └── app.ts
│   └── prisma/
│       └── schema.prisma
│
├── web/                    # Frontend React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── home/            # Landing page
│   │   │   └── generate/        # Video generator
│   │   └── services/
│   │       ├── ffmpeg.service.ts    # Video composition
│   │       ├── tts.service.ts       # Text-to-speech
│   │       └── subtitle.service.ts  # Subtitle generation
│   └── public/
│       └── background.mp4    # Your background video
│
└── README.md
```

## Known Limitations

- **Browser TTS**: Uses Web Speech API which doesn't capture audio directly. For production, integrate a cloud TTS service (ElevenLabs, Google Cloud TTS).
- **Processing Time**: Video generation takes 30-60 seconds depending on content length.
- **Browser Support**: Requires modern browser with SharedArrayBuffer support.

## Future Improvements

- [ ] Cloud TTS integration (ElevenLabs)
- [ ] Multiple background video options
- [ ] Custom voice selection
- [ ] Video templates/themes
- [ ] User accounts to save generated videos
- [ ] Queue system for batch processing

## License

MIT