import type { MetadataRoute } from "next";
import { getCurrentMembers } from "@/lib/congress-data";
import { getAllCommittees } from "@/lib/committee-data";
import { CHAMBERS } from "@/lib/chamber";
import { memberPath } from "@/lib/member-url";
import { committeePath } from "@/lib/committee-url";
import { getJusticeRefs } from "@/lib/justice-data";
import { justicePath } from "@/lib/justice-url";
import { getLandmarkLawRefs } from "@/lib/law-details-data";
import { lawPath } from "@/lib/law-url";
import { getLandmarkDecisionRefs } from "@/lib/decision-page-data";
import { decisionPath } from "@/lib/decision-url";
import { getPresidentSlugs } from "@/lib/president-data";
import { presidentPath } from "@/lib/president-url";
import { liveSections } from "@/lib/verticals";
import { branchFreshness, siteFreshness } from "@/lib/data-freshness";
import { parseDataDate } from "@/lib/freshness-dates";
import { absoluteUrl } from "@/lib/site";
import { CROSS_BRANCH_PAGES, STATIC_PAGES } from "@/lib/site-info";

const sectionDate = (href: string) =>
  href.startsWith("/congress") ? branchFreshness("congress") : href.startsWith("/supreme-court") ? branchFreshness("court") : branchFreshness("presidency");

export default function sitemap(): MetadataRoute.Sitemap {
  // Real data dates (lib/data-freshness.ts), not the build time: a crawler is told a page changed only when its data did.
  // A branch with no date leaves `lastModified` off.
  const site = siteFreshness();
  const congress = branchFreshness("congress");
  const court = branchFreshness("court");
  const presidency = branchFreshness("presidency");

  const profiles = CHAMBERS.flatMap((chamber) =>
    getCurrentMembers(chamber).map((m) => ({
      url: absoluteUrl(
        memberPath({ bioguideId: m.bioguideId, chamber, name: m.name }),
      ),
      lastModified: congress,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  );

  const committees = getAllCommittees().map((c) => ({
    url: absoluteUrl(committeePath(c)),
    lastModified: congress,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const justices = getJusticeRefs().map((j) => ({
    url: absoluteUrl(justicePath(j)),
    lastModified: court,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const presidents = getPresidentSlugs().map((slug) => ({
    url: absoluteUrl(presidentPath(slug)),
    lastModified: presidency,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const laws = getLandmarkLawRefs().map((l) => ({
    url: absoluteUrl(lawPath(l.lawId, l.title)),
    lastModified: parseDataDate(l.date),
    changeFrequency: "yearly" as const,
    priority: 0.4,
  }));

  const decisions = getLandmarkDecisionRefs().map((r) => ({
    url: absoluteUrl(decisionPath(r.caseId, r.name)),
    lastModified: court,
    changeFrequency: "yearly" as const,
    priority: 0.4,
  }));

  return [
    {
      url: absoluteUrl("/"),
      lastModified: site,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...liveSections().map((s) => ({
      url: absoluteUrl(s.href),
      lastModified: sectionDate(s.href),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...CROSS_BRANCH_PAGES.map((p) => ({
      url: absoluteUrl(p.href),
      lastModified: site,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...STATIC_PAGES.map((path) => ({
      url: absoluteUrl(path),
      lastModified: site,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...profiles,
    ...committees,
    ...justices,
    ...presidents,
    ...laws,
    ...decisions,
  ];
}
