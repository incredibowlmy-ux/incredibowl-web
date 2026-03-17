import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: () => Date.now().toString(),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
