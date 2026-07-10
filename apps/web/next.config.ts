import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
};

export default nextConfig;
