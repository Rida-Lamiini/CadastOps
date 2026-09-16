import * as maplibregl from "maplibre-gl";

/**
 * Turbopack doesn't correctly resolve the import.meta.url-relative Worker
 * construction inside maplibre-gl's bundled code — the worker ends up
 * pointing at the current page's own URL instead of its real script, tries
 * to run our page's HTML as JavaScript, and dies within a few ms of being
 * created. Every tile source then stays stuck at loaded=false forever and
 * `load` never fires. Pointing setWorkerUrl() at a statically-served copy
 * of maplibre-gl's own worker bundle (kept in sync by
 * scripts/copy-maplibre-worker.mjs, run on postinstall) sidesteps the bug.
 */
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
