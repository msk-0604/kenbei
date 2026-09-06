const LOCAL_HOST = /localhost|127\.0\.0\.1/i;

export function isKenbeiProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.KENBEI_ENV === "production";
}

export function resolveAppUrl(raw: string | undefined, production: boolean): string {
  const url = raw?.trim().replace(/\/$/, "") ?? "";
  if (production) {
    if (!url || LOCAL_HOST.test(url) || !url.startsWith("https://")) {
      throw new Error("NEXT_PUBLIC_APP_URL must be a public https origin in production");
    }
    return url;
  }
  return url || "http://localhost:3000";
}
