import type { NextConfig } from "next";

// Everything is served from this laptop: no external fonts, images or scripts.
const nextConfig: NextConfig = {
  compress: false, // keeps the streamed ETL log unbuffered
  poweredByHeader: false,
  serverExternalPackages: ["mysql2"],
  devIndicators: false,
  agentRules: false, // do not write AGENTS.md / CLAUDE.md during next dev
};

export default nextConfig;
