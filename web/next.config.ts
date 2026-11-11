import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'rxrrbznwnsgzpinirzme.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      // Uploads are resized in the browser first, but a little headroom
      // keeps a phone photo from being rejected.
      bodySizeLimit: '4mb',
    },
  },
};

export default nextConfig;
