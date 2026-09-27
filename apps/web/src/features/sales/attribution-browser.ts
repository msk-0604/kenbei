import {
  ATTRIBUTION_UTM_COOKIE,
  ATTRIBUTION_VISITOR_COOKIE,
  ATTRIBUTION_COOKIE_MAX_AGE_SEC,
  deserializeUtmAttribution,
  firstTouchUtm,
  isVisitorId,
  parseUtmSearch,
  serializeUtmAttribution,
} from "./attribution";

function readDocumentCookie(name: string): string | undefined {
  const parts = document.cookie.split("; ");
  const found = parts.find((part) => part.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : undefined;
}

function writeDocumentCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Max-Age=${ATTRIBUTION_COOKIE_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
}

export function captureBrowserAttribution(location: { search: string; pathname: string }): {
  visitorId: string;
  shouldRecordVisit: boolean;
} {
  const incoming = parseUtmSearch(new URLSearchParams(location.search.replace(/^\?/, "")), location.pathname);
  const existingVid = readDocumentCookie(ATTRIBUTION_VISITOR_COOKIE);
  const visitorId = isVisitorId(existingVid) ? existingVid : crypto.randomUUID();
  if (!isVisitorId(existingVid)) {
    writeDocumentCookie(ATTRIBUTION_VISITOR_COOKIE, visitorId);
  }
  const existingUtm = deserializeUtmAttribution(readDocumentCookie(ATTRIBUTION_UTM_COOKIE));
  const nextUtm = firstTouchUtm(existingUtm, incoming);
  if (nextUtm && (!existingUtm || serializeUtmAttribution(existingUtm) !== serializeUtmAttribution(nextUtm))) {
    writeDocumentCookie(ATTRIBUTION_UTM_COOKIE, serializeUtmAttribution(nextUtm));
  }
  const visitKey = "kb_visit_sent";
  const shouldRecordVisit = !sessionStorage.getItem(visitKey);
  if (shouldRecordVisit) {
    sessionStorage.setItem(visitKey, "1");
  }
  return { visitorId, shouldRecordVisit };
}
