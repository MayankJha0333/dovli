import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared packages ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ["@dovli/core", "@dovli/theme", "@dovli/editor"],
};

export default nextConfig;
