/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tokensceshi.oss-ap-southeast-1.aliyuncs.com',
        pathname: '/sora/**',
      },
    ],
  },
}

module.exports = nextConfig 