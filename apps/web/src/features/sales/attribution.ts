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
