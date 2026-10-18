import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Our shared packages ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ["@dovli/core", "@dovli/theme", "@dovli/ui", "@dovli/editor", "@dovli/sync"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
