import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/launch", destination: "/launch.html" },
        { source: "/explore", destination: "/explore.html" },
        { source: "/docs", destination: "/docs.html" },
      ],
    };
  },
};

export default nextConfig;
