export const ATTRIBUTION_VISITOR_COOKIE = "kb_vid";
export const ATTRIBUTION_UTM_COOKIE = "kb_utm";
export const ATTRIBUTION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export type UtmAttribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  landingPath: string;
};

const UTM_MAX = 120;

export function clipAttributionValue(value: string): string {
  return value.trim().slice(0, UTM_MAX);
}

export function emptyUtmAttribution(): UtmAttribution {
  return { source: "", medium: "", campaign: "", content: "", term: "", landingPath: "" };
}

export function parseUtmSearch(search: URLSearchParams, pathname = "/"): UtmAttribution {
  return {
    source: clipAttributionValue(search.get("utm_source") ?? ""),
    medium: clipAttributionValue(search.get("utm_medium") ?? ""),
    campaign: clipAttributionValue(search.get("utm_campaign") ?? ""),
    content: clipAttributionValue(search.get("utm_content") ?? ""),
    term: clipAttributionValue(search.get("utm_term") ?? ""),
    landingPath: clipAttributionValue(pathname || "/"),
  };
}

export function hasUtmValues(utm: UtmAttribution): boolean {
  return Boolean(utm.source || utm.medium || utm.campaign || utm.content || utm.term);
}

export function serializeUtmAttribution(utm: UtmAttribution): string {
  return encodeURIComponent(JSON.stringify(utm));
}

export function deserializeUtmAttribution(raw: string | undefined | null): UtmAttribution | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<UtmAttribution>;
    return {
      source: clipAttributionValue(String(parsed.source ?? "")),
      medium: clipAttributionValue(String(parsed.medium ?? "")),
      campaign: clipAttributionValue(String(parsed.campaign ?? "")),
      content: clipAttributionValue(String(parsed.content ?? "")),
      term: clipAttributionValue(String(parsed.term ?? "")),
      landingPath: clipAttributionValue(String(parsed.landingPath ?? "/")),
    };
  } catch {
    return null;
  }
}

export function firstTouchUtm(existing: UtmAttribution | null, incoming: UtmAttribution): UtmAttribution | null {
  if (existing && hasUtmValues(existing)) {
    return existing;
  }
  if (hasUtmValues(incoming)) {
    return incoming;
  }
  return existing;
}

export function isVisitorId(value: string | undefined | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

const METADATA_UTM_KEY = "kb_utm";
const METADATA_VISITOR_KEY = "kb_vid";

/**
 * 登録したときの流入元を、アカウントにも持たせる。
 * 確認メールを別の端末で開くとクッキーは引き継がれないため。
 */
export function attributionToUserMetadata(input: { visitorId: string | null; utm: UtmAttribution }): Record<string, unknown> | null {
  if (!hasUtmValues(input.utm)) {
    return null;
  }
  return {
    [METADATA_UTM_KEY]: { ...input.utm },
    ...(input.visitorId ? { [METADATA_VISITOR_KEY]: input.visitorId } : {}),
  };
}

export function attributionFromUserMetadata(metadata: unknown): { visitorId: string | null; utm: UtmAttribution | null } {
  if (!metadata || typeof metadata !== "object") {
    return { visitorId: null, utm: null };
  }
  const row = metadata as Record<string, unknown>;
  const vid = typeof row[METADATA_VISITOR_KEY] === "string" ? (row[METADATA_VISITOR_KEY] as string) : null;
  const raw = row[METADATA_UTM_KEY];
  const utm = raw && typeof raw === "object" ? deserializeUtmAttribution(encodeURIComponent(JSON.stringify(raw))) : null;
  return { visitorId: isVisitorId(vid) ? vid : null, utm: utm && hasUtmValues(utm) ? utm : null };
}

/** 会社を作った端末のクッキーを優先し、なければ登録したときにアカウントへ残した流入元を使う */
export function pickSignupAttribution(
  cookie: { visitorId: string | null; utm: UtmAttribution },
  metadata: unknown,
): { visitorId: string | null; utm: UtmAttribution } {
  const saved = attributionFromUserMetadata(metadata);
  const utm = hasUtmValues(cookie.utm) ? cookie.utm : (saved.utm ?? cookie.utm);
  return { visitorId: cookie.visitorId ?? saved.visitorId, utm };
}
