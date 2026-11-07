/**
 * The chart image behind the share menu's Download / Copy / Share image (`components/charts/ChartShare.tsx`). Browser-only.
 *
 * The card is cloned into an SVG `<foreignObject>` together with the page's own CSS (the
 * `@font-face` files the card's text actually uses, matched on family, weight, style and
 * unicode-range, fetched in parallel and inlined as data URLs, since an SVG drawn as an image
 * loads nothing external; the rest of the page's 30-odd faces are left out, which is what
 * made the first image take many seconds on a cold load) and the card's resolved custom properties (theme, branch accent, font
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

interface Face {
  css: string;
  base: string;
  family: string;
  lo: number;
  hi: number;
  italic: boolean;
  ranges: [number, number][] | null;
}
interface Sheets {
  sig: string;
  css: string;
  faces: Face[];
}

let sheetsCache: Sheets | null = null;

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");

/** "U+0-FF, U+131, U+4??" as ranges; null when the face covers everything. */
function parseRanges(s: string): [number, number][] | null {
  const out: [number, number][] = [];
  for (const part of s.split(",")) {
    const m = /U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i.exec(part.trim());
    if (!m) continue;
    if (m[1]!.includes("?")) out.push([parseInt(m[1]!.replace(/\?/g, "0"), 16), parseInt(m[1]!.replace(/\?/g, "F"), 16)]);
    else out.push([parseInt(m[1]!, 16), parseInt(m[2] ?? m[1]!, 16)]);
  }
  return out.length ? out : null;
}

/** "400", "200 800", "bold" as a [lo, hi] weight range; no descriptor covers every weight. */
function parseWeights(s: string): [number, number] {
  const n = s.match(/\d+/g)?.map(Number);
  if (n?.length) return [n[0]!, n[1] ?? n[0]!];
  if (s.trim() === "bold") return [700, 700];
  return s.trim() === "normal" ? [400, 400] : [1, 1000];
}

/**
 * The page's same-origin CSS (every rule but the `@font-face` ones, as one string) and its font
 * faces, read once and kept until the set of stylesheets changes (a client-side navigation adds some).
 */
function readSheets(): Sheets {
  const sheets = Array.from(document.styleSheets);
  const sig = sheets.map((s) => s.href ?? s.ownerNode?.textContent?.length ?? 0).join("|");
  if (sheetsCache?.sig === sig) return sheetsCache;
  const parts: string[] = [];
  const faces: Face[] = [];
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const [lo, hi] = parseWeights(rule.style.getPropertyValue("font-weight"));
        faces.push({
          css: rule.cssText,
          base: sheet.href ?? location.href,
          family: unquote(rule.style.getPropertyValue("font-family")),
          lo,
          hi,
          italic: /^(italic|oblique)/.test(rule.style.getPropertyValue("font-style")),
          ranges: parseRanges(rule.style.getPropertyValue("unicode-range")),
        });
      } else parts.push(rule.cssText);
    }
  }
  sheetsCache = { sig, css: parts.join("\n"), faces };
  return sheetsCache;
}

interface Used {
  families: string[];
  weight: number;
  italic: boolean;
}

/** The fonts the card's visible text is set in, and every character it uses. */
function usedFonts(card: HTMLElement): { used: Used[]; chars: Set<number> } {
  const used = new Map<string, Used>();
  const chars = new Set<number>();
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    const text = n.nodeValue ?? "";
    if (!el || !text.trim() || el.closest("details, [data-png-skip]")) continue;
    for (const ch of text) chars.add(ch.codePointAt(0)!);
    if (seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const key = `${cs.fontFamily}|${cs.fontWeight}|${cs.fontStyle}`;
    if (!used.has(key)) used.set(key, { families: cs.fontFamily.split(",").map(unquote), weight: Number(cs.fontWeight) || 400, italic: /^(italic|oblique)/.test(cs.fontStyle) });
  }
  return { used: [...used.values()], chars };
}

/** The font faces the card needs: a family, weight and style it uses, with a unicode-range it draws from. */
function neededFaces(faces: Face[], { used, chars }: ReturnType<typeof usedFonts>): Face[] {
  const hasItalic = new Set(faces.filter((f) => f.italic).map((f) => f.family));
  return faces.filter(
    (f) =>
      (!f.ranges || [...chars].some((c) => f.ranges!.some(([a, b]) => c >= a && c <= b))) &&
      used.some((u) => u.families.includes(f.family) && u.weight >= f.lo && u.weight <= f.hi && (f.italic === u.italic || (u.italic && !hasItalic.has(f.family)))),
  );
}

/** Font file (absolute URL) → data URL, fetched once per page life. */
const fontData = new Map<string, Promise<string>>();

function fontDataUrl(url: string): Promise<string> {
  let p = fontData.get(url);
  if (!p) {
    p = fetch(url).then((res) => (res.ok ? res.blob().then(blobToDataUrl) : Promise.reject(new Error(`font ${res.status}`))));
    p.catch(() => fontData.delete(url));
    fontData.set(url, p);
  }
  return p;
}

/** `css` with its font files inlined (an SVG drawn as an image loads nothing external), fetched in parallel. */
async function inlineUrls(css: string, base: string): Promise<string> {
  const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]!))].filter((u) => !u.startsWith("data:"));
  const data = await Promise.all(urls.map((u) => fontDataUrl(new URL(u, base).href).catch(() => null)));
  let out = css;
  urls.forEach((u, i) => {
    if (data[i]) out = out.split(u).join(data[i]!); // else: leave it, the text falls back to a system font
  });
  return out;
}

/** The page CSS plus only the font faces this card's text uses, inlined. */
async function cardCss(card: HTMLElement): Promise<string> {
  const { css, faces } = readSheets();
  const fonts = await Promise.all(neededFaces(faces, usedFonts(card)).map((f) => inlineUrls(f.css, f.base)));
  return `${css}\n${fonts.join("\n")}`;
}

/** Fetch the card's fonts now (cheap, cached) so a later `cardPng` doesn't wait on the network. */
export function warmCardPng(card: HTMLElement): void {
  cardCss(card).catch(() => {});
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
  const css = await cardCss(card);
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

/** Set once a browser refuses to read back a canvas that drew a `foreignObject` (Safari), so later images skip that attempt. */
let foreignObjectTainted = false;

/** Render `card` to a PNG blob (with the credit line). */
export async function cardPng(card: HTMLElement, siteName: string): Promise<Blob> {
  const cs = getComputedStyle(card);
  let bg = cs.backgroundColor;
  if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = getComputedStyle(document.body).backgroundColor || "#fff";
  const ink = getComputedStyle(document.body).color || "#111";
  const credit = creditLine(siteName, location.host, `${location.pathname}${location.search}${card.id ? `#${card.id}` : ""}`);
  if (!foreignObjectTainted) {
    try {
      return await cardPicture(card, bg, ink, credit);
    } catch (e) {
      if (e instanceof DOMException && e.name === "SecurityError") foreignObjectTainted = true;
    }
  }
  return svgPicture(card, bg, ink, credit);
}

/** The file name for a card's image: `insidegov-<title>.png`. */
export function pngName(card: HTMLElement, siteName: string): string {
  const title = (card.querySelector("h2, h3")?.textContent ?? document.title).trim();
  return `${slugify(siteName)}-${slugify(title)}.png`;
}

/** Save a rendered PNG as a file. */
export function savePng(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
