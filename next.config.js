/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'instagram.com',
      'facebook.com',
      'tiktok.com',
      'youtube.com',
      'yt3.ggpht.com',
      'scontent.cdninstagram.com',
      'p16-sign.tiktokcdn-us.com',
      'graph.facebook.com',
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;