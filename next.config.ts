import type { NextConfig } from "next";

const ignoredDevWatchPaths = [
  "**/node_modules/**",
  "**/.git/**",
  "**/output/**",
  "**/.data/**",
  "**/.playwright-browsers/**"
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: ignoredDevWatchPaths
      };
    }

    return config;
  }
};

export default nextConfig;
