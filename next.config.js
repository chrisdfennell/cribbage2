/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces .next/standalone (a self-contained server.js + minimal deps)
  // so the Docker image stays small for Fly.io.
  output: "standalone",
};

module.exports = nextConfig;
