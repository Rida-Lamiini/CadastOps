// Turbopack doesn't correctly resolve the import.meta.url-relative Worker
// construction inside maplibre-gl's bundled code (the worker ends up
// pointing at the page's own URL instead of its script, and silently dies
// on creation — see src/lib/map/setup-worker.ts). Serving a static copy of
// maplibre-gl's own worker bundle and pointing setWorkerUrl() at it sidesteps
// the bug entirely. Re-run automatically on every `npm install` so it stays
// in sync with the installed maplibre-gl version.
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(root, "..", "node_modules", "maplibre-gl", "dist");
const destDir = path.join(root, "..", "public", "maplibre");

mkdirSync(destDir, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}
console.log("Copied maplibre-gl worker files to public/maplibre/");
