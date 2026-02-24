/**
 * Electron preload script.
 * Runs in a sandboxed renderer context before the web page loads.
 * Use contextBridge to expose safe APIs to the renderer if needed.
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
});
