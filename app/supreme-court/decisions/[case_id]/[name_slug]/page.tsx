import type { Metadata } from "next";
import { decisionSeo } from "@/lib/entity-seo";
import { pageMetadata } from "@/lib/seo";
import { notFound, permanentRedirect } from "next/navigation";
import { DecisionPageView } from "@/components/decisions/detail/DecisionPageView";
import { getDecisionPage, getDecisionRef, getDecisionRefs } from "@/lib/decision-page-data";
import { decisionPath, decisionSlug, isCaseId } from "@/lib/decision-url";

interface RouteParams {
  case_id: string;
  name_slug: string;
}

/**
 * Pre-built: the two most recent terms' cases and every landmark. The other ~7k cases render on first request and are then
 * cached (`dynamicParams`), the way the law pages handle theirs.
 */
export function generateStaticParams(): RouteParams[] {
  const refs = getDecisionRefs();
  const newest = new Set([...new Set(refs.map((r) => r.term))].sort((a, b) => b - a).slice(0, 2));
  return refs.filter((r) => newest.has(r.term) || r.landmark).map((r) => ({ case_id: r.caseId, name_slug: decisionSlug(r.name) }));
}

// A valid id with a stale slug is not pre-built: keep dynamicParams on so the request reaches the page, which redirects to
// the canonical URL (a real HTTP redirect, so no loading.tsx here).
export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { case_id } = await params;
  const d = isCaseId(case_id) ? getDecisionPage(case_id) : null;
  if (!d) return { title: "Decision not found" };
  const { title, description } = decisionSeo({
    shortName: d.shortName,
    decided: d.decided,
    lead: d.sentence?.text ?? d.summary?.paragraphs[0] ?? null,
    maj: d.vote.maj,
    min: d.vote.min,
    area: d.area?.label ?? null,
    disposition: d.disposition,
  });
  return pageMetadata({ title, description, path: decisionPath(d.caseId, d.name), type: "article", ownImage: true });
}

export default async function DecisionPage({ params }: { params: Promise<RouteParams> }) {
  const { case_id, name_slug } = await params;
  const ref = isCaseId(case_id) ? getDecisionRef(case_id) : null;
  if (!ref) notFound();
  if (name_slug !== decisionSlug(ref.name)) permanentRedirect(decisionPath(ref.caseId, ref.name));
  const d = getDecisionPage(case_id);
  if (!d) notFound();
  return <DecisionPageView d={d} />;
}
