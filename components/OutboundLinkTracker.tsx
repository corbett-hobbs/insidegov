"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * One document-level listener that reports every click on a link to another site (source citations, Wikipedia,
 * Congress.gov), so no link component has to remember to. Renders nothing.
 */
export function OutboundLinkTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.host === window.location.host) return;
      track("outbound_click", { host: url.host, href: `${url.origin}${url.pathname}`.slice(0, 200) });
    };
    document.addEventListener("click", onClick);
    document.addEventListener("auxclick", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("auxclick", onClick);
    };
  }, []);
  return null;
}
