/**
 * Editable facts for the About page and the footer, in one place.
 *
 * A blank string means "omit that sentence": the About page never prints a
 * placeholder. Fill a value in and the matching sentence appears.
 */
export const siteInfo = {
  /** Who builds and maintains the site, e.g. "one person" or a name. Blank = the "Who's behind it" section is left out. */
  builderName: "Corbett Hobbs",
  /** One sentence on funding / ads, shown under Independence. Blank = omitted. */
  fundingStatement: "It is a personal project and has no connection to my employer.",
  /** One or two sentences on why it was built, shown under "Why it exists". Blank = omitted. */
  whyIBuiltIt: "",
  /** The public repo (the old congress-ideology name redirects here). */
  githubUrl: "https://github.com/corbett-hobbs/insidegov",
  /** The accounts that post new charts when government data is released (pipeline/insights). Blank = not linked anywhere. */
  blueskyUrl: "https://bsky.app/profile/insidegov.fyi",
  xUrl: "https://x.com/insidegovfyi",
  threadsUrl: "https://www.threads.com/@insidegovfyi",
} as const;

/** The social accounts that are filled in, in display order. */
export function socialLinks(): { label: string; url: string }[] {
  const all: { label: string; url: string }[] = [
    { label: "X", url: siteInfo.xUrl },
    { label: "Bluesky", url: siteInfo.blueskyUrl },
    { label: "Threads", url: siteInfo.threadsUrl },
  ];
  return all.filter((l) => l.url !== "");
}

/** Link to a methodology write-up in the public repo, on `main`. */
export function docUrl(docPath: string): string {
  return `${siteInfo.githubUrl}/blob/main/${docPath}`;
}

/** Top-level pages that sit outside every vertical: no tab is active, no section nav,
 *  and the wordmark is a plain link to "/" (like the hub). */
export const STATIC_PAGES = ["/about", "/methodology", "/contact", "/api"] as const;

/** Top-level pages that span every branch: a neutral tab after the branch tabs (not a branch colour), no section row, and the
 *  wordmark is a plain link to "/". */
export const CROSS_BRANCH_PAGES = [{ href: "/timeline", label: "Timeline" }] as const;
