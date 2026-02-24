/**
 * Build script for Electron.
 *
 * 1. Bundles electron/main.ts  → dist-electron/main.js
 * 2. Bundles electron/preload.ts → dist-electron/preload.js
 * 3. Bundles api/src/app.ts    → dist-electron/api-bundle/app.js
 *
 * All Node/Electron built-ins are marked external so they aren't bundled.
 */

import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const commonOptions = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  target: 'node20',
  // Don't bundle Electron or Node built-ins
  external: [
    'electron',
    'fsevents',
  ],
};

async function main() {
  console.log('Building Electron main process...');
  await build({
    ...commonOptions,
    entryPoints: [path.join(root, 'electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.js'),
    // banner to support import.meta.url in CJS-like contexts
    banner: {
      js: `
import { createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_fn } from 'path';
`,
    },
  });

  console.log('Building Electron preload...');
  await build({
    ...commonOptions,
    entryPoints: [path.join(root, 'electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.js'),
    // Preload runs in renderer — still Node context but sandboxed
  });

  console.log('Building API bundle...');
  await build({
    ...commonOptions,
    entryPoints: [path.join(root, 'api/src/app.ts')],
    outfile: path.join(root, 'dist-electron/api-bundle/app.js'),
    // Resolve modules from the API's own node_modules
    nodePaths: [path.join(root, 'api/node_modules')],
    banner: {
      js: `
import { createRequire } from 'module';
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_fn } from 'path';
`,
    },
  });

  console.log('Electron build complete.');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
