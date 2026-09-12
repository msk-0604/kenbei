import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { pdfFontTraceIncludes } from "./src/lib/pdf-font-trace";

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
    "/api/pdf/[kind]/[id]/route": [...pdfFontTraceIncludes],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
});
