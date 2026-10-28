import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @nexo/shared é TypeScript puro no monorepo.
  transpilePackages: ['@nexo/shared'],
};

export default nextConfig;
