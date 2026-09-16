import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // pdf-parse (via pdfjs-dist) sets up a worker with an import.meta.url-relative
  // path that Turbopack's server bundling resolves incorrectly (mirrors the
  // maplibre-gl worker issue — see src/components/map/setup-worker.ts).
  // Excluding it from bundling leaves plain Node module resolution to find
  // its worker file, which works correctly.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
