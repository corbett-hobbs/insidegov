/**
 * The chart image behind the share menu's "Download image" (`components/charts/ChartShare.tsx`). Browser-only.
 *
 * The card is cloned into an SVG `<foreignObject>` together with the page's own CSS (its
 * `@font-face` files inlined as data URLs, since an SVG drawn as an image loads nothing
 * external) and the card's resolved custom properties (theme, branch accent, font
 * variables), drawn onto a 2x canvas, and given a credit line naming the page and the
 * exact view (path + query, see `lib/use-url-state.ts`), so a shared image leads back.
 * Controls that make no sense in a picture (`<details>` notes and tables, the notes
 * row this button sits in, anything marked `data-png-skip`) are left out.
 *
 * If the browser refuses to read the canvas back (Safari taints canvases that drew a
 * `<foreignObject>`), it falls back to the card's largest `<svg>` with computed
 * styles inlined: the plot without its HTML labels, still with the credit line.
 */

const SCALE = 2;
const PAD = 24;
const FOOTER = 40;

let cssCache: Promise<string> | null = null;

/** Every same-origin stylesheet's text, with font files inlined. Cached for the page's life. */
function pageCss(): Promise<string> {
  cssCache ??= (async () => {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      for (const rule of Array.from(rules)) {
        let text = rule.cssText;
        if (rule.constructor.name === "CSSFontFaceRule" || text.startsWith("@font-face")) {
          text = await inlineUrls(text, sheet.href ?? location.href);
        }
        parts.push(text);
      }
    }
    return parts.join("\n");
  })();
  return cssCache;
}

async function inlineUrls(css: string, base: string): Promise<string> {
  const urls = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]!);
  let out = css;
  for (const u of new Set(urls)) {
    if (u.startsWith("data:")) continue;
    try {
      const res = await fetch(new URL(u, base));
      if (!res.ok) continue;
      out = out.split(u).join(await blobToDataUrl(await res.blob()));
    } catch {
      /* leave it; the text falls back to a system font */
    }
  }
  return out;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Custom properties and the few inherited text properties the card sees, as an inline style. */
function contextStyle(el: Element): string {
  const cs = getComputedStyle(el);
  const out: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!;
    if (p.startsWith("--")) out.push(`${p}:${cs.getPropertyValue(p)}`);
  }
  for (const p of ["color", "font-family", "font-size", "line-height", "color-scheme"]) out.push(`${p}:${cs.getPropertyValue(p)}`);
  return out.join(";");
}

function cleanClone(card: HTMLElement): HTMLElement {
  const clone = card.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details, [data-png-skip], script, noscript").forEach((n) => n.remove());
  // Images would load nothing inside the picture; drop them rather than leave broken boxes.
  clone.querySelectorAll("img").forEach((n) => n.remove());
  clone.style.margin = "0";
  return clone;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function finish(img: HTMLImageElement, w: number, h: number, bg: string, ink: string, credit: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = (w + PAD * 2) * SCALE;
  canvas.height = (h + PAD * 2 + FOOTER) * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w + PAD * 2, h + PAD * 2 + FOOTER);
  ctx.drawImage(img, PAD, PAD, w, h);
  ctx.fillStyle = ink;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(credit, PAD, h + PAD + FOOTER / 2 + 4, w);
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty canvas"))), "image/png");
    } catch (e) {
      reject(e);
    }
  });
}

async function cardPicture(card: HTMLElement, bg: string, ink: string, credit: string): Promise<Blob> {
  const w = Math.ceil(card.getBoundingClientRect().width);
  const clone = cleanClone(card);
  // Lay the trimmed clone out off-screen once to learn its height without the notes row.
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;left:-100000px;top:0;width:${w}px`;
  probe.appendChild(clone);
  card.parentElement!.appendChild(probe);
  const h = Math.ceil(probe.getBoundingClientRect().height) + 8;
  probe.remove();
  const css = await pageCss();
  const html = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" overflow="hidden">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="${escapeAttr(contextStyle(card))};width:${w}px">` +
    `<style>${escapeText(css)}</style>${html}</div></foreignObject></svg>`;
  const img = await loadImage(svgDataUrl(svg));
  return finish(img, w, h, bg, ink, credit);
}

/** Fallback: the card's largest SVG with every element's computed paint inlined. */
async function svgPicture(card: HTMLElement, bg: string, ink: string, credit: string): Promise<Blob> {
  const svgs = Array.from(card.querySelectorAll("svg")).filter((s) => s.getBoundingClientRect().width > 120);
  const src = svgs.sort((a, b) => area(b) - area(a))[0];
  if (!src) throw new Error("no chart to export");
  const rect = src.getBoundingClientRect();
  const clone = src.cloneNode(true) as SVGSVGElement;
  const from = [src, ...Array.from(src.querySelectorAll("*"))];
  const to = [clone, ...Array.from(clone.querySelectorAll("*"))];
  const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "visibility", "display"];
  from.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (to[i] as SVGElement).setAttribute("style", PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  const img = await loadImage(svgDataUrl(new XMLSerializer().serializeToString(clone)));
  return finish(img, Math.ceil(rect.width), Math.ceil(rect.height), bg, ink, credit);
}

const area = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width * r.height;
};

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** "the-goods-trade-balance-with-china" from a card title. */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chart"
  );
}

/** The credit line under the picture: site, then the page and view it came from. */
export function creditLine(siteName: string, host: string, pathAndQuery: string): string {
  return `${siteName} · ${host}${pathAndQuery}`;
}

/** Render `card` to a PNG blob (with the credit line). */
export async function cardPng(card: HTMLElement, siteName: string): Promise<Blob> {
  const cs = getComputedStyle(card);
  let bg = cs.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = getComputedStyle(document.body).backgroundColor || "#fff";
  const ink = getComputedStyle(document.body).color || "#111";
  const credit = creditLine(siteName, location.host, `${location.pathname}${location.search}${card.id ? `#${card.id}` : ""}`);
  try {
    return await cardPicture(card, bg, ink, credit);
  } catch {
    return svgPicture(card, bg, ink, credit);
  }
}

/** Render `card` to a PNG and save it as `insidegov-<title>.png`. */
export async function downloadCardPng(card: HTMLElement, siteName: string): Promise<void> {
  const blob = await cardPng(card, siteName);
  const title = (card.querySelector("h2, h3")?.textContent ?? document.title).trim();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slugify(siteName)}-${slugify(title)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
