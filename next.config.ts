// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow Google Fonts to be loaded in the layout
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
