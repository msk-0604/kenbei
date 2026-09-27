import {
  ATTRIBUTION_UTM_COOKIE,
  ATTRIBUTION_VISITOR_COOKIE,
  deserializeUtmAttribution,
  emptyUtmAttribution,
  isVisitorId,
  type UtmAttribution,
} from "./attribution";

export type AttributionCookieReader = {
  get(name: string): { value: string } | undefined;
};

export function readAttributionFromCookies(store: AttributionCookieReader): {
  visitorId: string | null;
  utm: UtmAttribution;
} {
  const visitorId = store.get(ATTRIBUTION_VISITOR_COOKIE)?.value;
  return {
    visitorId: isVisitorId(visitorId) ? visitorId : null,
    utm: deserializeUtmAttribution(store.get(ATTRIBUTION_UTM_COOKIE)?.value) ?? emptyUtmAttribution(),
  };
}

export function stripeAttributionMetadata(input: { visitorId: string | null; utm: UtmAttribution }): Record<string, string> {
  const meta: Record<string, string> = {};
  if (input.visitorId) {
    meta.visitor_id = input.visitorId;
  }
  if (input.utm.source) {
    meta.utm_source = input.utm.source;
  }
  if (input.utm.medium) {
    meta.utm_medium = input.utm.medium;
  }
  if (input.utm.campaign) {
    meta.utm_campaign = input.utm.campaign;
  }
  if (input.utm.content) {
    meta.utm_content = input.utm.content;
  }
  if (input.utm.term) {
    meta.utm_term = input.utm.term;
  }
  return meta;
}
