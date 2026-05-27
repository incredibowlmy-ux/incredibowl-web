import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: () => Date.now().toString(),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    // The smallest default deviceSize is 640, so small slots (e.g. the ~228px
    // menu thumbnails) were forced to fetch w=640. Add 256/384 candidates so
    // standard-DPR devices can pick a tighter width. No quality change.
    deviceSizes: [256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  async headers() {
    return [
      {
        // Cache all static images in /public for 1 year
        source: '/:path*.(webp|png|jpg|jpeg|svg|ico|gif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Internal ops dashboard — Firebase admin auth gated, URL obscured.
        // No browser cache so updates land immediately + robots block.
        // Single-segment :slug (no `*`) is the path-to-regexp v6 syntax Next 16 expects.
        source: '/dashboard-:slug.html',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        // Security headers for all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
