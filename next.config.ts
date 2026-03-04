import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ['pg', 'pg-native', '@prisma/adapter-pg'],
};

export default nextConfig;
