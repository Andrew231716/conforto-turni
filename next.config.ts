import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Marker for Next.js security agent upgrade path
    agentUpgrade: "security",
  },
};

export default nextConfig;
