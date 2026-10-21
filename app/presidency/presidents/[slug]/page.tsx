import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPresidentPage, getPresidentSlugs } from "@/lib/president-data";
import { ordinalWord, termYears } from "@/lib/president-derive";
import { presidentPath } from "@/lib/president-url";
import { site, ogDefaults, twitterDefaults } from "@/lib/site";
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
  const terms = p.terms.map((t) => `${ordinalWord(t.ordinal)} president, ${termYears(t)}`).join("; ");
  const description = `${p.name} (${terms}): laws signed, executive orders, justices appointed, party control of Congress, and the economy, immigration, trade, foreign aid and troops abroad during the time in office.`;
  const url = presidentPath(slug);
  return {
    title: p.name,
    description,
    alternates: { canonical: url },
    openGraph: { ...ogDefaults, title: `${p.name} · ${site.name}`, description, url, type: "profile" },
    twitter: twitterDefaults,
  };
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
