"use client";

import { useEffect } from "react";
import { ATTRIBUTION_UTM_COOKIE, deserializeUtmAttribution } from "./attribution";
import { captureBrowserAttribution } from "./attribution-browser";

export function AttributionCapture() {
  useEffect(() => {
    const { visitorId, shouldRecordVisit } = captureBrowserAttribution(window.location);
    if (!shouldRecordVisit) {
      return;
    }
    const utm = deserializeUtmAttribution(
      document.cookie
        .split("; ")
        .find((part) => part.startsWith(`${ATTRIBUTION_UTM_COOKIE}=`))
        ?.slice(ATTRIBUTION_UTM_COOKIE.length + 1),
    );
    void fetch("/api/funnel/visit", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId, utm }),
    }).catch(() => undefined);
  }, []);
  return null;
}
