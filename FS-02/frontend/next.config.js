const path = require("path");
// Single .env at the repository root is shared with the backend
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false, // Yjs providers are created/destroyed in effects; avoid double-mount noise in dev
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000",
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};
