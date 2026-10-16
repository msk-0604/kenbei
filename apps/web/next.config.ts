import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { pdfFontTraceIncludes } from "./src/lib/pdf-font-trace";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // kenbei-alpha に合わせて「現場」は /sites に移した。日報・チャット等の記録は /projects/[id] のまま。
  async redirects() {
    return [
      { source: "/projects", destination: "/sites", permanent: false },
      { source: "/projects/new", destination: "/sites/new", permanent: false },
    ];
  },
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
    // Keep visited/prefetched pages in the client router cache briefly so
    // switching tabs is instant. Server actions still revalidate on write.
    staleTimes: {
      dynamic: 30,
      static: 60,
    },
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
