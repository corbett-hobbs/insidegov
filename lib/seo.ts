import type { Metadata } from "next";
import { ogDefaults, site, topicOg, topicTwitter, twitterDefaults } from "./site";

/**
 * Search-snippet helpers shared by every page's metadata. Pure, so the rules are unit-tested.
 *
 * Titles: the layout's template appends " · InsideGov", and search results cut a title at roughly 60 characters, so a
 * page title is written to fit in `TITLE_BUDGET` with the suffix, keywords first. Descriptions: one or two sentences,
 * cut at a sentence end (else a word) within `DESCRIPTION_MAX`, never mid-word.
 */
export const TITLE_SUFFIX = ` · ${site.name}`;
export const TITLE_MAX = 60;
/** Room for a page title once the layout template adds the site name. */
export const TITLE_BUDGET = TITLE_MAX - TITLE_SUFFIX.length;
export const DESCRIPTION_MAX = 160;

/**
 * `base` plus the first of `extras` that keeps the title inside the budget, else `base` alone. Lets an entity page add
 * "Voting Record and Net Worth" for a short name and drop it for a long one instead of being cut off mid-phrase.
 */
export function fitTitle(base: string, extras: readonly string[], budget = TITLE_BUDGET): string {
  for (const extra of extras) if (base.length + extra.length <= budget) return base + extra;
  return base;
}

const STOP_TAIL = /\s+(?:a|an|and|as|at|by|for|from|in|of|on|or|the|to|with|under|into|that|which)$/i;

/** Cut `text` to `max` characters at a word boundary with an ellipsis, dropping a dangling "of the"-style tail. */
export function truncateWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  if (space > max * 0.5) cut = cut.slice(0, space);
  for (let prev = ""; prev !== cut; ) {
    prev = cut;
    cut = cut.replace(/[\s,;:–—-]+$/, "").replace(STOP_TAIL, "");
  }
  return `${cut}…`;
}

/** A period that ends an initial, title or abbreviation rather than a sentence. */
const ABBREVIATION = /(?:\b[A-Z]|\b(?:v|vs|No|U\.S|St|Mt|Ft|Mr|Mrs|Ms|Dr|Jr|Sr|Inc|Co|Corp|Ltd|Gen|Lt|Col|Capt|Cpl|Sgt|Pfc|Pvt|Spc|Adm|Maj|Cmdr|Rev|Hon|Gov|Sen|Rep|Sec|Jan|Feb|Mar|Apr|Aug|Sept?|Oct|Nov|Dec|etc|approx|rel|al|Bros|Assn|Dept|Comm|Cir))\.$/;

/**
 * A meta description within `max` characters: whole sentences when the first one fits, else the first sentence cut at a
 * word. Whitespace is collapsed and a trailing space-before-period left by upstream text is tidied.
 */
export function clampDescription(text: string, max = DESCRIPTION_MAX): string {
  const t = text.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  if (t.length <= max) return t;
  // Sentence ends: a period, ! or ? followed by a space and a capital, not after a lone initial or common abbreviation.
  const ends: number[] = [];
  const re = /[.!?](?=\s+["“(]?[A-Z0-9])/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const before = t.slice(Math.max(0, m.index - 6), m.index + 1);
    if (ABBREVIATION.test(before)) continue;
    // Not inside a quotation: "as the "Lance Cpl. Stacy Dryden Post Office."" is one sentence.
    if ((t.slice(0, m.index).match(/["“”]/g)?.length ?? 0) % 2 === 1) continue;
    ends.push(m.index + 1);
  }
  const fit = ends.filter((i) => i <= max);
  if (fit.length) return t.slice(0, fit[fit.length - 1]);
  return truncateWords(t, max);
}

/**
 * Page metadata with matching Open Graph and Twitter fields. `title` is the bare page title: the layout template adds
 * the site name when the two fit in `TITLE_MAX`; a longer title (a law, a case, a member with a long name) goes out on
 * its own, keywords before brand, cut at a word if it still runs over. Pass `ownImage` on a route that has its own
 * `opengraph-image`, so the site-wide card is not listed alongside it.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  /** Shorter share-card text; defaults to `description`. */
  socialDescription?: string;
  type?: "website" | "article" | "profile";
  ownImage?: boolean;
  /** The title already names the site (the homepage): never add the suffix. */
  absolute?: boolean;
  /** A topic page's data share card (`topicOg` in `lib/site.ts`, e.g. "presidency/economy") instead of the site-wide image. */
  topic?: string;
}): Metadata {
  const description = clampDescription(opts.description);
  const social = opts.socialDescription ? clampDescription(opts.socialDescription) : description;
  const fits = !opts.absolute && opts.title.length <= TITLE_BUDGET;
  const socialTitle = fits ? `${opts.title}${TITLE_SUFFIX}` : opts.title;
  const { images: siteImages, ...og } = ogDefaults;
  const images = opts.topic ? topicOg(opts.topic).images : siteImages;
  const twitterImages = opts.topic ? { images: topicTwitter(opts.topic).images } : twitterDefaults;
  return {
    title: fits ? opts.title : { absolute: truncateWords(opts.title, TITLE_MAX) },
    description,
    alternates: { canonical: opts.path },
    openGraph: { ...og, ...(opts.ownImage ? {} : { images }), type: opts.type ?? "website", title: socialTitle, description: social, url: opts.path },
    twitter: { ...(opts.ownImage ? {} : twitterImages), card: "summary_large_image", title: socialTitle, description: social },
  };
}
