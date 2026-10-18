/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development'

const nextConfig = {
  distDir: isDevelopment ? '.next-dev' : '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
