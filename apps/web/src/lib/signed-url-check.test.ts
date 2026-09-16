import { describe, expect, it, vi } from "vitest";
import { signedUrlServesImage } from "./signed-url-check";

describe("signedUrlServesImage", () => {
  it("accepts image content-type", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 206, headers: { "content-type": "image/jpeg" } }));
    await expect(signedUrlServesImage("https://example.invalid/p.jpg", fetchImpl as unknown as typeof fetch)).resolves.toBe(
      true,
    );
  });

  it("rejects json error bodies from storage render", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 400, headers: { "content-type": "application/json" } }),
    );
    await expect(signedUrlServesImage("https://example.invalid/p.jpg", fetchImpl as unknown as typeof fetch)).resolves.toBe(
      false,
    );
  });
});
