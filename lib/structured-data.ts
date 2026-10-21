import { METHODOLOGY, type MethodEntry } from "./methodology-content";
import { absoluteUrl, site } from "./site";
import { siteInfo } from "./site-info";

/**
 * schema.org JSON-LD builders. Pure (no server-only imports) so they can be unit-tested; `components/JsonLd.tsx`
 * renders the result. Dataset facts (sources, update cadence) come from `lib/methodology-content.ts`, the one place
 * they are written down, so the markup cannot drift from the Methodology page.
 */
export type JsonLdNode = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** Serialise for a `<script type="application/ld+json">`: `<` is escaped so no string can close the tag. */
export const serializeJsonLd = (node: JsonLdNode | JsonLdNode[]): string => JSON.stringify(node).replace(/</g, "\\u003c");

const publisher = (): JsonLdNode => ({ "@type": "Organization", name: site.name, url: absoluteUrl("/") });

/** Site-wide: who publishes this and what the site is. No SearchAction: search is an in-page modal with no URL-addressable results page. */
export function siteJsonLd(): JsonLdNode[] {
  return [
    {
      "@context": CONTEXT,
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: site.name,
      url: absoluteUrl("/"),
      description: site.description,
      founder: { "@type": "Person", name: siteInfo.builderName },
      sameAs: [siteInfo.githubUrl],
    },
    {
      "@context": CONTEXT,
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: site.name,
      alternateName: site.tagline,
      url: absoluteUrl("/"),
      description: site.description,
      inLanguage: "en-US",
      publisher: { "@id": absoluteUrl("/#organization") },
    },
  ];
}

/** Which Methodology entries describe each topic page, and the span of time the page covers. */
interface TopicDataset {
  name: string;
  entries: string[];
  /** First date covered (ISO 8601 year, month or day); the end is the branch's data date or open-ended. */
  from: string;
  /** Overrides the default licence when the underlying data carries its own terms. */
  license?: string;
}

const US_GOV_WORKS = "https://www.usa.gov/government-works";

const TOPICS: Record<string, TopicDataset> = {
  "/presidency/economy": { name: "U.S. economic indicators by presidential term", entries: ["economy", "recessions"], from: "1991-01" },
  "/presidency/energy": { name: "U.S. energy production, prices and reserves", entries: ["energy"], from: ".." },
  "/presidency/immigration": { name: "U.S. immigration enforcement, border encounters and refugee admissions", entries: ["immigration", "border-encounters"], from: ".." },
  "/presidency/trade": { name: "U.S. trade by country, product and use", entries: ["trade"], from: "1991-01" },
  "/presidency/foreign-aid": { name: "U.S. foreign assistance disbursements by country", entries: ["foreign-aid"], from: "2001" },
  "/presidency/troops-abroad": { name: "U.S. military personnel and bases abroad", entries: ["troops-abroad"], from: "1950", license: "https://www.gnu.org/licenses/gpl-3.0.html" },
  "/presidency/executive-orders": { name: "U.S. executive orders by topic", entries: ["executive-orders"], from: "1994-01-15" },
  "/congress/ideology": { name: "DW-NOMINATE ideology scores for members of Congress", entries: ["ideology"], from: "1789", license: "https://voteview.com/about" },
  "/congress/laws": { name: "Public laws enacted by Congress", entries: ["laws"], from: "1973" },
  "/congress/demographics": { name: "Demographics of members of Congress", entries: ["demographics"], from: ".." },
  "/congress/wealth": { name: "Net worth of members of Congress", entries: ["net-worth"], from: ".." },
  "/supreme-court/ideology": { name: "Martin–Quinn ideology scores for Supreme Court justices", entries: ["court-ideology"], from: "1937" },
  "/supreme-court/decisions": {
    name: "Supreme Court decisions, 1946 onward",
    entries: ["decisions"],
    from: "1946",
    license: "https://creativecommons.org/licenses/by-nc/3.0/us/",
  },
};

const methodEntry = (id: string): MethodEntry | undefined => METHODOLOGY.flatMap((g) => g.entries).find((e) => e.id === id);

/** The Methodology entry ids behind a topic page. */
export const topicEntryIds = (path: string): string[] => TOPICS[path]?.entries ?? [];

/** Topic page paths that have Dataset markup. */
export const datasetPaths = (): string[] => Object.keys(TOPICS);

/**
 * `Dataset` markup for one topic page, or `null` for a path that has none. `dateModified` is the branch's data date
 * (`lib/data-freshness.ts`); leave it off when unknown rather than guess.
 */
export function datasetJsonLd(path: string, opts: { description: string; dateModified?: Date }): JsonLdNode | null {
  const topic = TOPICS[path];
  if (!topic) return null;
  const entries = topic.entries.map(methodEntry).filter((e): e is MethodEntry => !!e);
  const sources = entries.flatMap((e) => e.sources);
  const first = entries[0];
  const end = opts.dateModified?.toISOString().slice(0, 10);
  return {
    "@context": CONTEXT,
    "@type": "Dataset",
    name: topic.name,
    description: opts.description,
    url: absoluteUrl(path),
    isAccessibleForFree: true,
    license: topic.license ?? US_GOV_WORKS,
    creator: sources.length
      ? sources.map((s) => ({ "@type": "Organization", name: s.name, ...(s.url ? { url: s.url } : {}) }))
      : publisher(),
    isBasedOn: sources.filter((s) => s.url).map((s) => s.url),
    publisher: publisher(),
    temporalCoverage: `${topic.from || ".."}/${end ?? ".."}`,
    ...(opts.dateModified ? { dateModified: opts.dateModified.toISOString().slice(0, 10) } : {}),
    ...(first ? { citation: first.credit?.replace(/\*/g, "") } : {}),
    includedInDataCatalog: { "@type": "DataCatalog", name: `${site.name} data API`, url: absoluteUrl("/api") },
  };
}

/** `Person` markup for a member of Congress, justice or president. */
export function personJsonLd(opts: {
  path: string;
  name: string;
  jobTitle: string;
  description: string;
  image?: string | null;
  affiliation?: string;
  birthDate?: string;
}): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Person",
    name: opts.name,
    url: absoluteUrl(opts.path),
    jobTitle: opts.jobTitle,
    description: opts.description,
    ...(opts.image ? { image: absoluteUrl(opts.image) } : {}),
    ...(opts.affiliation ? { affiliation: { "@type": "Organization", name: opts.affiliation } } : {}),
    ...(opts.birthDate ? { birthDate: opts.birthDate } : {}),
    mainEntityOfPage: absoluteUrl(opts.path),
  };
}

/** `Legislation` markup for a public law. */
export function legislationJsonLd(opts: {
  path: string;
  name: string;
  publicLaw: string;
  congressLabel: string;
  date: string;
  description?: string;
  sourceUrl?: string;
}): JsonLdNode {
  return {
    "@context": CONTEXT,
    "@type": "Legislation",
    name: opts.name,
    legislationIdentifier: opts.publicLaw,
    legislationType: "Public law",
    legislationJurisdiction: "US",
    legislationDate: opts.date,
    datePublished: opts.date,
    url: absoluteUrl(opts.path),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.sourceUrl ? { sameAs: opts.sourceUrl } : {}),
    isPartOf: { "@type": "Legislation", name: `${opts.congressLabel} U.S. Congress` },
  };
}
