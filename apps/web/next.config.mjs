/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Prisma client lives in the workspace package; transpile it for the app.
  transpilePackages: ['@scout-os/database'],
  // Type-checking still runs during build (tsc). ESLint is run separately via
  // `pnpm lint` — Next's in-build lint can't resolve the shared eslint config
  // across pnpm's isolated node_modules, so we don't gate the build on it.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
    ],
  },
};

export default nextConfig;
