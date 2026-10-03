import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KENBEI",
    short_name: "KENBEI",
    description: "現場の記録から、今日の事務まで。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#0b1220",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
