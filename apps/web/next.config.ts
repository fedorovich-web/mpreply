import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Native image codecs include libraries loaded by the binary at runtime.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@img/sharp-*/lib/**/*", "./node_modules/@img/sharp-libvips-*/lib/**/*"],
  },
  poweredByHeader: false,
  compress: true,
  agentRules: false,
  images: {
    formats: ["image/webp"],
    qualities: [85],
  },
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ...(process.env.NODE_ENV === "production"
          ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
          : []),
      ],
    }];
  },
};

export default nextConfig;
