import type { NextConfig } from "next";

/** Must stay project-relative. Absolute paths are joined onto the app root on Vercel and ENOENT. */
export const pdfFontTraceIncludes = ["./fonts/NotoSansJP-Regular.ttf", "./fonts/**"] as const;

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
    "/api/pdf/[kind]/[id]": [...pdfFontTraceIncludes],
  },
};

export default nextConfig;
