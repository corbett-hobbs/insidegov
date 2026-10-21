"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cardPng, downloadCardPng, slugify } from "@/lib/chart-png";
import { site } from "@/lib/site";
import { shareLinks } from "@/lib/chart-share";

/**
 * The share icon after a chart card's title (ARCHITECTURE_MAP rule 7e). `ChartNotesRow` renders
 * this once per card; it finds its card (the nearest `[data-chart-card]`, `section` or `article`)
 * and the card's first `h2`/`h3`, and portals a muted icon button to the end of that heading, so
 * a value or toggle on the right of the title row keeps its place. The card gets an `id` (from
 * its title) so "Copy link" can point at this chart in the current view (path + filters + `#id`),
 * and a link with that hash scrolls to it on load.
 *
 * The menu (portalled to `<body>`, fixed under the icon, so no card clips it): Copy link, Download
 * image (`lib/chart-png.ts`), Post on X, Bluesky, LinkedIn, Email; on devices with a share sheet,
 * "Share…" (link) and "Share image" first.
 */

/** Three connected dots, the platform-neutral "share" glyph (not the iOS box-and-arrow). */
const ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="6" r="2.6" />
    <circle cx="18" cy="18" r="2.6" />
    <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
  </svg>
);

interface Target {
  card: HTMLElement;
  slot: HTMLElement;
  title: string;
}

function cardOf(marker: HTMLElement): HTMLElement | null {
  return marker.closest<HTMLElement>("[data-chart-card], section, article");
}

/** A stable anchor from a title: years and "so far" dropped, so a link survives the next data year. */
function anchorFor(title: string): string {
  return slugify(title).replace(/-(\d{4}|so-far)(?=-|$)/g, "") || "chart";
}

function attach(card: HTMLElement): Target | null {
  const heading = card.querySelector<HTMLElement>("h2, h3");
  if (!heading || heading.querySelector("[data-share-slot]")) return null;
  const title = (heading.textContent ?? "").trim();
  if (!card.id) {
    const base = anchorFor(title);
    let id = base;
    for (let n = 2; document.getElementById(id); n++) id = `${base}-${n}`;
    card.id = id;
  }
  card.style.scrollMarginTop = "8rem";
  const slot = document.createElement("span");
  slot.dataset.shareSlot = "";
  slot.dataset.pngSkip = "";
  slot.style.cssText = "display:inline-flex;vertical-align:middle;margin-left:0.4rem";
  // Where the title fills its column (a phone, a value beside it), the icon wraps under the title.
  heading.appendChild(slot);
  return { card, slot, title };
}

export function ChartShare() {
  const [target, setTarget] = useState<Target | null>(null);
  const marker = useCallback((el: HTMLSpanElement | null) => {
    if (!el) return;
    const card = cardOf(el);
    if (!card) return;
    let current: Target | null = null;
    // A card can re-render its title (a country loads, a year changes) and drop the slot with it: re-attach.
    const sync = () => {
      if (current?.slot.isConnected) return;
      const t = attach(card);
      if (!t) return;
      current = t;
      setTarget(t);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(card, { childList: true, subtree: true });
    // A link to this chart (`#id`) lands on it once the page has laid out.
    if (location.hash === `#${card.id}`) setTimeout(() => card.scrollIntoView({ block: "start" }), 400);
    return () => {
      mo.disconnect();
      current?.slot.remove();
      setTarget(null);
    };
  }, []);

  return (
    <span ref={marker} hidden>
      {target && createPortal(<ShareButton target={target} />, target.slot)}
    </span>
  );
}

function ShareButton({ target }: { target: Target }) {
  const [open, setOpen] = useState<DOMRect | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label="Share this chart"
        title="Share this chart"
        aria-haspopup="menu"
        aria-expanded={open != null}
        onClick={() => setOpen(open ? null : btn.current!.getBoundingClientRect())}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-line bg-transparent p-0 text-ink-faint hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-expanded:text-ink"
      >
        {ICON}
      </button>
      {open && createPortal(<ShareMenu target={target} at={open} onClose={() => setOpen(null)} returnFocus={btn} />, document.body)}
    </>
  );
}

const ITEM =
  "flex w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-[0.85rem] text-ink no-underline hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] focus-visible:outline-2 focus-visible:outline-focus";

function ShareMenu({ target, at, onClose, returnFocus }: { target: Target; at: DOMRect; onClose: () => void; returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const menu = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const url = `${location.origin}${location.pathname}${location.search}#${target.card.id}`;
  const text = `${target.title} · ${site.name}`;
  const links = shareLinks(url, text);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !returnFocus.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        returnFocus.current?.focus();
      }
    };
    // Close on a real scroll, not the few pixels a tap can nudge the page on a phone.
    const y0 = window.scrollY;
    const scroll = () => {
      if (Math.abs(window.scrollY - y0) > 40) onClose();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, returnFocus]);

  const W = 232;
  const left = Math.max(8, Math.min(at.left, window.innerWidth - W - 8));

  const done = (msg: string) => {
    setNote(msg);
    setTimeout(onClose, 900);
  };

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`Share ${target.title}`}
      style={{ position: "fixed", top: at.bottom + 6, left, width: W }}
      className="z-50 rounded-[10px] border border-line bg-surface p-1 shadow-[0_10px_26px_rgba(10,12,16,0.16)]"
    >
      {note ? (
        <p role="status" className="m-0 px-2.5 py-1.5 text-[0.85rem] text-ink">
          {note}
        </p>
      ) : (
        <>
          {canShare && (
            <>
              <button role="menuitem" type="button" className={ITEM} onClick={() => navigator.share({ title: text, url }).then(onClose, () => {})}>
                Share…
              </button>
              <button
                role="menuitem"
                type="button"
                className={ITEM}
                onClick={async () => {
                  setNote("Making the image…");
                  try {
                    const blob = await cardPng(target.card, site.name);
                    const file = new File([blob], `${slugify(site.name)}-${slugify(target.title)}.png`, { type: "image/png" });
                    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: text, url });
                    else await downloadCardPng(target.card, site.name);
                    onClose();
                  } catch {
                    // The share sheet needs a fresh tap on some phones; saving the file still works.
                    await downloadCardPng(target.card, site.name).catch(() => {});
                    onClose();
                  }
                }}
              >
                Share image
              </button>
              <hr className="mx-1 my-1 border-0 border-t border-line" />
            </>
          )}
          <button
            role="menuitem"
            type="button"
            className={ITEM}
            onClick={() =>
              navigator.clipboard.writeText(url).then(
                () => done("Link copied"),
                () => done("Couldn’t copy the link"),
              )
            }
          >
            Copy link to this chart
          </button>
          <button
            role="menuitem"
            type="button"
            className={ITEM}
            onClick={() => {
              setNote("Saving…");
              downloadCardPng(target.card, site.name).then(
                () => done("Image saved"),
                () => done("Couldn’t save the image"),
              );
            }}
          >
            Download image (PNG)
          </button>
          <hr className="mx-1 my-1 border-0 border-t border-line" />
          {links.map((l) => (
            <a key={l.label} role="menuitem" href={l.href} target="_blank" rel="noopener noreferrer" className={ITEM} onClick={onClose}>
              {l.label}
            </a>
          ))}
        </>
      )}
    </div>
  );
}
