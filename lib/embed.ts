/**
 * Embedding a chart card on another site (`components/charts/ChartShare.tsx` builds the snippet,
 * `components/charts/EmbedMode.tsx` renders the embedded view, `public/embed.js` resizes the frame).
 *
 * The embed is the chart's own page with `?embed=<card id>` (and `&theme=light|dark`): every other
 * part of the page is hidden and only that card shows, with the page's filters still in the query
 * string, so one mechanism covers every chart. Pure helpers here; browser code lives in the components.
 */

export const EMBED_PARAM = "embed";
export const THEME_PARAM = "theme";
export type EmbedTheme = "light" | "dark";

/** The message the embedded page posts to its parent, which `public/embed.js` turns into the frame's height. */
export const EMBED_HEIGHT_MESSAGE = "insidegov:embed-height";

/** `pageUrl` (the current view) turned into the embed URL for card `id`: no hash, the embed and theme params set. */
export function embedUrl(pageUrl: string, id: string, theme: EmbedTheme): string {
  const u = new URL(pageUrl);
  u.hash = "";
  u.searchParams.set(EMBED_PARAM, id);
  u.searchParams.set(THEME_PARAM, theme);
  return u.toString();
}

/** The link back to the full chart, from an embed's own URL: the embed and theme params dropped, the card's `#id` added. */
export function embedSourceUrl(embedHref: string): string {
  const u = new URL(embedHref);
  const id = u.searchParams.get(EMBED_PARAM) ?? "";
  u.searchParams.delete(EMBED_PARAM);
  u.searchParams.delete(THEME_PARAM);
  u.hash = id;
  return u.toString();
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * The code a site owner pastes. The frame works alone at the given height; the script (optional,
 * some CMSs strip it) resizes it to the card as filters or notes open and close.
 */
export function embedSnippet({ url, title, height, origin }: { url: string; title: string; height: number; origin: string }): string {
  return (
    `<iframe src="${attr(url)}" title="${attr(title)}" width="100%" height="${height}" style="border:0;max-width:100%" loading="lazy"></iframe>\n` +
    `<script src="${attr(origin)}/embed.js" async></script>`
  );
}

/**
 * Runs in the page `<head>` before first paint (`app/layout.tsx`): marks an embed view so the CSS
 * can hide the page at once instead of flashing it, and forces the requested theme (light unless
 * `theme=dark`, so a dark-mode visitor on a light host page doesn't get a dark card). If the card
 * never turns up, the page is shown after 8 seconds rather than left blank.
 */
export const EMBED_BOOT = `(function(){try{var p=new URLSearchParams(location.search),e=p.get("${EMBED_PARAM}");if(!e)return;var d=document.documentElement;d.setAttribute("data-embed",e);d.setAttribute("data-theme",p.get("${THEME_PARAM}")==="dark"?"dark":"light");setTimeout(function(){d.setAttribute("data-embed-ready","")},8000)}catch(_){}})()`;
