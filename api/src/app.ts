import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import api from './routes/api.routes.js';
import video from './routes/video.routes.js';
const app = express();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', api);
app.use('/video', video);

// Only auto-listen when run directly (not when imported by Electron)
const isDirectRun = process.argv[1]?.includes('app');
if (isDirectRun) {
  app.listen(port, () => {
    console.log('Server is running on port: ' + String(port));
  });
}

/** Start listening programmatically (used by Electron main process) */
export function startServer(overridePort?: number): void {
  const p = overridePort ?? port;
  app.listen(p, () => {
    console.log('Server is running on port: ' + String(p));
  });
}

export default app;
