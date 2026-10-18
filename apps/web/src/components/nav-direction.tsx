"use client";

import { useEffect } from "react";

/**
 * 画面の切り替えの向きを <html data-nav> に入れる（CSS の .page-enter が見る）。
 * ・戻る（ブラウザの戻る・スワイプで戻る）→ back
 * ・下のタブ（data-nav-tab の付いたリンク）→ tab
 * ・それ以外のリンク → forward
 */
export function NavDirection() {
  useEffect(() => {
    const root = document.documentElement;
    const onPop = () => {
      root.dataset.nav = "back";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) {
        return;
      }
      root.dataset.nav = link.hasAttribute("data-nav-tab") ? "tab" : "forward";
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);
  return null;
}
