import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // Removed for Vercel deployment
  allowedDevOrigins: ["https://*.space-z.ai", "http://localhost:81"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "z-cdn.chatglm.cn" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
