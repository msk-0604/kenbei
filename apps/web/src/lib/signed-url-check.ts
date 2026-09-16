export async function signedUrlServesImage(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Range: "bytes=0-16" },
      signal: controller.signal,
    });
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    return res.ok && type.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
