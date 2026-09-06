import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@kensapo/ai",
    "@kensapo/authz",
    "@kensapo/decision-engine",
    "@kensapo/domain",
    "@kensapo/graph",
    "@kensapo/ingest",
    "@kensapo/similar-projects",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/pdf/[kind]/[id]": ["./fonts/**"],
  },
};

export default nextConfig;
