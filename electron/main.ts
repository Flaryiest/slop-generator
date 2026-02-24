import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// Resolve paths — different in dev vs packaged builds
// ---------------------------------------------------------------------------

/** Root of the project in dev, or the app resources dir in production */
function getProjectRoot(): string {
  if (isDev) {
    return path.resolve(__dirname, '..');
  }
  // In a packaged app, extra resources live under process.resourcesPath
  return process.resourcesPath;
}

/** Path to the bundled API entry that electron-builder copies into resources */
function getApiEntryPath(): string {
  if (isDev) {
    return path.join(getProjectRoot(), 'api', 'src', 'app.ts');
  }
  return path.join(getProjectRoot(), 'api-bundle', 'app.js');
}

/** Path to the Vite-built web frontend (production only) */
function getWebDistPath(): string {
  return path.join(getProjectRoot(), 'web', 'dist');
}

// ---------------------------------------------------------------------------
// API Server
// ---------------------------------------------------------------------------

function startApiServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In dev, the user starts the API separately
      // We just wait until the API is reachable
      const waitForApi = async () => {
        for (let i = 0; i < 60; i++) {
          try {
            const res = await fetch('http://localhost:8080/api/test');
            if (res.ok) { resolve(); return; }
          } catch { /* not ready yet */ }
          await new Promise(r => setTimeout(r, 500));
        }
        reject(new Error('API server did not start within 30 seconds'));
      };
      waitForApi();
      return;
    }

    // Production: import and run the API directly in the main process.
    // Electron's main process IS Node.js, so Express works fine here.
    // This avoids spawning process.execPath (which would launch another Electron instance).
    const apiEntry = getApiEntryPath();

    // Set environment variables before importing
    process.env.PORT = '8080';
    process.env.NODE_ENV = 'production';
    process.env.PIPER_DIR_OVERRIDE = path.join(getProjectRoot(), 'piper', 'piper');

    import(apiEntry)
      .then((mod) => {
        // The API module exports startServer() — call it to begin listening
        if (typeof mod.startServer === 'function') {
          mod.startServer(8080);
        } else if (typeof mod.default?.listen === 'function') {
          // Fallback: if startServer isn't available, call listen directly
          mod.default.listen(8080, () => {
            console.log('Server is running on port: 8080');
          });
        }
        // Wait briefly for the server to be ready
        setTimeout(async () => {
          for (let i = 0; i < 20; i++) {
            try {
              const res = await fetch('http://localhost:8080/api/test');
              if (res.ok) { resolve(); return; }
            } catch { /* not ready */ }
            await new Promise(r => setTimeout(r, 250));
          }
          reject(new Error('API server did not respond after import'));
        }, 500);
      })
      .catch((err) => {
        console.error('Failed to import API module:', err);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Reely',
    backgroundColor: '#0a0a0a',
    show: false, // Show after ready-to-show to avoid flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Graceful show
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // Dev: load from the Vite dev server
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load the built index.html
    mainWindow.loadFile(path.join(getWebDistPath(), 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    await startApiServer();
  } catch (err) {
    console.error('Could not start API server:', err);
    // Continue anyway — user may have it running separately
  }

  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon clicked & no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

