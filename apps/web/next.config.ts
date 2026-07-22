import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  turbopack: {
    root: appRoot,
  },
  experimental: {
    cpus: 4,
  },
};

export default nextConfig;
