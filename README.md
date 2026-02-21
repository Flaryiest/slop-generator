# Reely

Transform Reddit stories into short-form video, automatically.

## Features

- **Reddit Scraping** — Paste any Reddit post URL to extract the story
- **Auto Narration** — Text-to-speech reads the story aloud via Piper TTS
- **Dynamic Subtitles** — Word-by-word subtitles synced with speech
- **Reel-Ready** — 9:16 vertical format for Instagram / TikTok
- **60s Limit** — Automatically truncates content to fit short-form
- **Browser-Based** — All video processing happens client-side with ffmpeg.wasm
- **Local Library** — Videos are saved to IndexedDB and browsable in a sidebar
- **Search & Filter** — Trie-based prefix search, date range filtering, multiple sort algorithms

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + TypeScript |
| Video Processing | ffmpeg.wasm (WebAssembly) |
| TTS | Piper TTS (local ONNX model) |
| Backend | Node.js + Express |
| Storage | IndexedDB (client-side) |

## Getting Started

### Prerequisites

- Node.js 18+
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

### 2. Add Background Video

Place a video file at `web/public/background.mp4`.

Recommended sources:
- [Pexels](https://www.pexels.com/videos/) (free stock videos)
- [Pixabay](https://pixabay.com/videos/)

Popular choices: Minecraft parkour, Subway Surfers, satisfying videos.

### 3. Start Development

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
reely/
├── api/                    # Backend API
│   ├── src/
│   │   ├── routes/
│   │   │   └── video.routes.ts   # Reddit scraping & TTS endpoints
│   │   ├── services/
│   │   │   └── reddit.service.ts # Reddit scraping
│   │   └── app.ts
│
├── web/                    # Frontend React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── home/            # Landing page
│   │   │   └── generate/        # Video generator
│   │   ├── components/
│   │   │   ├── sidebar/         # Video library sidebar
│   │   │   └── icons/           # SVG icon components
│   │   └── services/
│   │       ├── ffmpeg.service.ts       # Video composition
│   │       ├── tts.service.ts          # Text-to-speech
│   │       ├── subtitle.service.ts     # Subtitle generation
│   │       ├── videoStorage.service.ts # IndexedDB persistence
│   │       ├── sorting.service.ts      # Sort algorithms
│   │       └── search.service.ts       # Trie search & filters
│   └── public/
│       └── background.mp4    # Your background video
│
└── README.md
```

## Known Limitations

- **Browser TTS**: Uses Piper TTS locally; quality depends on the ONNX voice model.
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