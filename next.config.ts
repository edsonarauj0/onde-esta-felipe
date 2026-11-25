import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', 'unpdf'],
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;
