/**
 * Site-wide constants and the canonical base URL.
 *
 * On Vercel `VERCEL_PROJECT_PRODUCTION_URL` is the stable production domain and
 * is set at build time. `NEXT_PUBLIC_SITE_URL` overrides it (set that once
 * there's a custom domain). Falls back to localhost for `pnpm dev`.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export const site = {
  name: "InsideGov",
  /** Slug form — kept in sync with package.json `name`, not the display name. */
  shortName: "congress-ideology",
  tagline: "The U.S. government, by the numbers",
  /** Whole-site blurb: the default meta description and the share-card text. */
  description:
    "The data behind the headlines, from the government's own records: gas prices, mortgage rates, tariffs, deportations, the deficit, the laws Congress passes and Supreme Court decisions, plus executive orders, energy, foreign aid, troops abroad, and who serves in Congress.",
  /** The Congress ideology explorer's own blurb (`/congress/ideology`). */
  congressIdeologyDescription:
    "Every member of Congress's votes reduced to a two-dimensional ideology score (DW-NOMINATE, 1st–119th Congress). Scrub through 236 years of the House and Senate, filter a state's delegation, and read any current member's trajectory.",
} as const;

/**
 * Open Graph fields every page repeats. A page's `openGraph` replaces the
 * layout's wholesale (Next merges metadata one level deep), so each page
 * spreads these in to keep the site name, type and share image.
 */
export const ogDefaults: {
  type: "website";
  siteName: string;
  images: { url: string; width: number; height: number }[];
} = {
  type: "website",
  siteName: site.name,
  images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
};

export const twitterDefaults: { images: string[] } = {
  images: ["/opengraph-image"],
};

/**
 * Open Graph and Twitter fields for a topic page with a data share card
 * (`app/og/[topic]/route.tsx`, figures from `lib/og-topics.ts`). One prerendered
 * route serves every card: per-page `opengraph-image.tsx` files would each count as
 * a serverless function, and the Hobby plan allows 12 per deployment.
 */
export const ogTopicSlug = (path: string) => path.replace(/\//g, "-");

function topicImage(path: string) {
  return { url: `/og/${ogTopicSlug(path)}`, width: 1200, height: 630, alt: `${site.name}: the latest figure and its trend for /${path}` };
}

export function topicOg(path: string): { type: "website"; siteName: string; images: ReturnType<typeof topicImage>[] } {
  return { type: "website", siteName: site.name, images: [topicImage(path)] };
}

export function topicTwitter(path: string): { card: "summary_large_image"; images: ReturnType<typeof topicImage>[] } {
  return { card: "summary_large_image", images: [topicImage(path)] };
}

export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
