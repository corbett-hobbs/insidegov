import type { Metadata } from "next";
import { presidentSeo } from "@/lib/entity-seo";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getPresidentPage, getPresidentSlugs } from "@/lib/president-data";
import { ordinalWord, termYears } from "@/lib/president-derive";
import { presidentPath } from "@/lib/president-url";
import { JsonLd } from "@/components/JsonLd";
import { personJsonLd } from "@/lib/structured-data";
import { PresidentPageView } from "@/components/presidents/PresidentPageView";

interface RouteParams {
  slug: string;
}

/** One static page per president with a page (Truman on), at the administrations tables' `president_slug`. */
export function generateStaticParams(): RouteParams[] {
  return getPresidentSlugs().map((slug) => ({ slug }));
}

// The set of presidents is fixed at build time; any other slug is a 404.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getPresidentPage(slug);
  if (!data) return { title: "President not found" };
  const p = data.president;
  const { title, description } = presidentSeo({
    name: p.name,
    terms: p.terms.map((t) => ({ ordinal: ordinalWord(t.ordinal), years: termYears(t) })),
    party: p.party,
    serving: p.terms[p.terms.length - 1]!.end === null,
    laws: data.laws ? { signed: data.laws.signed, major: data.laws.major } : null,
    // Only a count that covers the whole time in office (the record starts in 1994).
    executiveOrders: data.eos && !data.eos.coverage ? data.eos.total : null,
    justices: data.justices.filter((j) => !j.elevated).length,
    congress: data.congress.days,
    sections: Object.keys(data.cards),
  });
  return pageMetadata({ title, description, path: presidentPath(slug), type: "profile" });
}

export default async function PresidentPage({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const data = getPresidentPage(slug);
  if (!data) notFound();
  const p = data.president;
  return (
    <>
      <JsonLd
        data={personJsonLd({
          path: presidentPath(slug),
          name: p.name,
          jobTitle: `${ordinalWord(p.terms[0].ordinal)} President of the United States`,
          description: `${p.name}, ${p.terms.map((t) => termYears(t)).join(" and ")}.`,
          image: p.photo,
          affiliation: "Executive Office of the President of the United States",
        })}
      />
      <PresidentPageView data={data} />
    </>
  );
}
