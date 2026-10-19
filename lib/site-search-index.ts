import "server-only";
import { getMemberSearchIndex } from "./congress-data";
import { getCommitteeSearchIndex } from "./committee-data";
import { getJusticeRefs } from "./justice-data";
import { memberPath } from "./member-url";
import { committeePath } from "./committee-url";
import { justicePath } from "./justice-url";
import { stateName } from "./states";
import { branches } from "./verticals";
import { CROSS_BRANCH_PAGES, STATIC_PAGES } from "./site-info";
import type { SearchEntry } from "./site-search";

/** Extra words people type for a page, keyed by `/<vertical>/<section>`. */
const PAGE_ALIASES: Record<string, string> = {
  "/presidency/executive-orders": "eo orders president",
  "/presidency/economy": "jobs unemployment inflation gdp gas prices",
  "/presidency/energy": "oil electricity lng spr petroleum reserve",
  "/presidency/immigration": "ice deportation removals green card refugees",
  "/presidency/trade": "tariffs duties imports exports",
  "/presidency/foreign-aid": "assistance usaid",
  "/presidency/troops-abroad": "troops bases military",
  "/congress/ideology": "senate house dw-nominate",
  "/congress/laws": "bills legislation enacted",
  "/congress/demographics": "age gender tenure",
  "/congress/wealth": "net worth financial disclosures",
  "/supreme-court/ideology": "scotus martin quinn justices",
  "/supreme-court/decisions": "scotus cases rulings opinions",
};

const BRANCH_ALIASES: Record<string, string> = {
  presidency: "president executive white house",
  congress: "senate house legislature",
  "supreme-court": "scotus judiciary justices",
};

const STATIC_LABELS: Record<(typeof STATIC_PAGES)[number], string> = {
  "/about": "About",
  "/methodology": "Methodology",
  "/contact": "Contact",
  "/api": "API and MCP",
};

const PARTY = { dem: "D", rep: "R", other: "I" } as const;

/** Every entity the homepage search can jump to: live section pages, current members, justices, committees. */
export function getSiteSearchIndex(): SearchEntry[] {
  const pages: SearchEntry[] = [
    ...branches
      .filter((b) => b.status === "live")
      .map((b): SearchEntry => ({ n: b.label, s: "Branch of government", u: b.href, k: "page", a: BRANCH_ALIASES[b.id] })),
    ...branches.flatMap((b) =>
      b.sections
        .filter((s) => s.status === "live")
        .map((s): SearchEntry => ({ n: s.label, s: b.label, u: s.href, k: "page", a: PAGE_ALIASES[s.href] })),
    ),
    ...CROSS_BRANCH_PAGES.map((p): SearchEntry => ({ n: "Who held power when it happened", s: "All three branches", u: p.href, k: "page", a: "timeline landmark laws cases president senate house court party control history" })),
    ...STATIC_PAGES.map((u): SearchEntry => ({ n: STATIC_LABELS[u], s: "InsideGov", u, k: "page" })),
  ];

  const members = getMemberSearchIndex().map((m): SearchEntry => {
    const seat = m.chamber === "senate" ? m.state : m.district ? `${m.state}-${m.district}` : `${m.state}-AL`;
    return {
      n: m.name,
      s: `${m.chamber === "senate" ? "Senator" : "Representative"} · ${PARTY[m.group]}-${seat}`,
      u: memberPath({ bioguideId: m.bioguideId, chamber: m.chamber, name: m.name }),
      k: "member",
      a: stateName(m.state),
    };
  });

  const justices = getJusticeRefs().map(
    (j): SearchEntry => ({ n: j.name, s: "Supreme Court justice", u: justicePath(j), k: "justice" }),
  );

  const committees = getCommitteeSearchIndex().map(
    (c): SearchEntry => ({
      n: c.shortName,
      s: c.name === c.shortName ? "Committee" : c.name,
      u: committeePath(c),
      k: "committee",
      a: c.name,
    }),
  );

  return [...pages, ...members, ...justices, ...committees];
}
