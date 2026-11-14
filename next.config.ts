import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/api/**": ["./data/**", "./public/samples/**", "./prompts/**"] },
};

export default nextConfig;
