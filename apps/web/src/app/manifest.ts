import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KENBEI",
    short_name: "KENBEI",
    description: "現場の記録から、今日の事務まで。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#0f172a",
    lang: "ja",
  };
}
