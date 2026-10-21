"use client";

import { useEffect } from "react";
import { EMBED_HEIGHT_MESSAGE, EMBED_PARAM, embedSourceUrl } from "@/lib/embed";
import { site } from "@/lib/site";

/**
 * Renders the embedded view of a chart (`?embed=<card id>`, see `lib/embed.ts`). Mounted once in the
 * root layout, it waits for the card with that id (`ChartShare` gives every card its id), then
 * hides everything else on the page by marking the siblings of each of the card's ancestors
 * (`data-embed-hide`) and flattening those ancestors (`data-embed-flat`; the CSS is in `globals.css`),
 * adds a credit line linking to the full chart, and tells a parent page the card's height so
 * `public/embed.js` can size the frame. Filters come from the query string as on the full page.
 * The head script (`EMBED_BOOT`) has already hidden the page, so nothing flashes.
 */
export function EmbedMode() {
  useEffect(() => {
    const id = new URLSearchParams(location.search).get(EMBED_PARAM);
    if (!id) return;

    const watchers: MutationObserver[] = [];
    let resizer: ResizeObserver | null = null;

    const hideSiblings = (card: HTMLElement) => {
      for (let node: HTMLElement = card; node !== document.documentElement; ) {
        const parent: HTMLElement = node.parentElement!;
        for (const sib of Array.from(parent.children)) {
          // A tooltip is portalled to <body> while the pointer is over the chart: leave it be.
          if (sib !== node && !sib.matches(".chart-tooltip, [data-embed-keep]")) sib.setAttribute("data-embed-hide", "");
        }
        if (parent !== document.documentElement) parent.setAttribute("data-embed-flat", "");
        node = parent;
      }
    };

    const enter = (card: HTMLElement) => {
      card.setAttribute("data-embed-card", "");
      hideSiblings(card);
      // A page that renders more siblings later (a bar that loads in) gets them hidden too.
      for (let el: HTMLElement | null = card.parentElement; el; el = el.parentElement) {
        const mo = new MutationObserver(() => hideSiblings(card));
        mo.observe(el, { childList: true });
        watchers.push(mo);
      }
      if (!card.querySelector(":scope > .embed-credit")) {
        const credit = document.createElement("a");
        credit.className = "embed-credit";
        credit.href = embedSourceUrl(location.href);
        credit.target = "_blank";
        credit.rel = "noopener";
        credit.textContent = `${site.name} · View this chart`;
        card.appendChild(credit);
      }
      document.documentElement.setAttribute("data-embed-ready", "");
      const post = () => window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, id, height: Math.ceil(card.getBoundingClientRect().height) + 2 }, "*");
      resizer = new ResizeObserver(post);
      resizer.observe(card);
      post();
    };

    const find = () => {
      const card = document.getElementById(id);
      if (!card) return false;
      enter(card);
      return true;
    };

    let waiting: MutationObserver | null = null;
    if (!find()) {
      waiting = new MutationObserver(() => {
        if (find()) waiting?.disconnect();
      });
      waiting.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["id"] });
    }
    return () => {
      waiting?.disconnect();
      watchers.forEach((w) => w.disconnect());
      resizer?.disconnect();
    };
  }, []);

  return null;
}
