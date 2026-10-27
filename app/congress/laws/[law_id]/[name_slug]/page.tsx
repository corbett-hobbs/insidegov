import type { Metadata } from "next";
import { lawSeo, lawSummaryLead } from "@/lib/law-seo";
import { pageMetadata } from "@/lib/seo";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { legislationJsonLd } from "@/lib/structured-data";
import { LawPageView } from "@/components/laws/detail/LawPageView";
import { getLawPage, getLawRef, getLawRefs } from "@/lib/law-details-data";
import { lawPath, lawSlug } from "@/lib/law-url";
import { ordinal } from "@/lib/laws-entities";

interface RouteParams {
  law_id: string;
  name_slug: string;
}

/**
 * Pre-built: the two most recent Congresses' laws and every Mayhew major law. The other ~11k laws render on first request
 * and are then cached (`dynamicParams`), the way the member and justice pages handle a stale or unlisted URL.
 */
export function generateStaticParams(): RouteParams[] {
  return getPrebuiltLawRefs().map((r) => ({ law_id: r.lawId, name_slug: lawSlug(r.title) }));
}

// A valid id with a stale slug is not pre-built: keep dynamicParams on so the request reaches the page, which redirects to
// the canonical URL (a real HTTP redirect, so no loading.tsx here).
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { law_id } = await params;
  const law = getLawPage(law_id);
  if (!law) return { title: "Law not found" };
  const { title, description } = lawSeo({
    lawId: law.lawId,
    shortTitle: law.shortTitle,
    officialTitle: law.officialTitle ?? law.title,
    summary: law.summary,
    president: law.president.name,
    date: law.date,
    veto: law.veto,
    originChamber: law.originChamber,
    passage: law.passage,
    chartChambers: law.votes.map((v) => v.chamber),
    hasCommittees: law.committees.length > 0,
  });
  return pageMetadata({ title, description, path: lawPath(law.lawId, law.title), type: "article", ownImage: true });
}

export default async function LawPage({ params }: { params: Promise<RouteParams> }) {
  const { law_id, name_slug } = await params;
  const ref = getLawRef(law_id);
  if (!ref) notFound();
  if (name_slug !== lawSlug(ref.title)) permanentRedirect(lawPath(ref.lawId, ref.title));
  const law = getLawPage(law_id);
  if (!law) notFound();
  return (
    <>
      <JsonLd
        data={legislationJsonLd({
          path: lawPath(law.lawId, law.title),
          name: law.shortTitle,
          alternateName: law.shortTitle !== law.title ? law.title : undefined,
          publicLaw: law.publicLaw,
          congressLabel: ordinal(law.congress),
          date: law.date,
          description: lawSummaryLead(law.summary, [law.shortTitle, law.title]) ?? undefined,
        })}
      />
      <LawPageView law={law} />
    </>
  );
}
