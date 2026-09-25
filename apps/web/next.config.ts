import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/webp"],
    qualities: [85],
  },
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
};

export default nextConfig;
