import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Build a self-contained server bundle for the Cloud Run container image
  // (see Dockerfile — it ships .next/standalone and runs `node server.js`).
  output: "standalone",
};

export default nextConfig;
