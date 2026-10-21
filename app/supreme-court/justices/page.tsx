import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { PageShortcuts } from "@/components/PageShortcuts";
import { SourceLink } from "@/components/SourceLink";
import { CurrentCourt } from "@/components/court/directory/CurrentCourt";
import { DirectoryTable } from "@/components/court/directory/DirectoryTable";
import { TenureTimeline } from "@/components/court/directory/TenureTimeline";
import { getJusticeDirectory } from "@/lib/justice-directory-data";
import { site, topicOg, topicTwitter } from "@/lib/site";
import { UpNext } from "@/components/UpNext";

/** /supreme-court/justices — the Supreme Court vertical's Justices section: the way into every justice profile. */
export const metadata: Metadata = {
  title: "Who has sat on the Supreme Court?",
  description: "The nine justices on the Supreme Court today and every justice since the 1937 term: how long each served, who appointed them, how the Senate voted to confirm them and how often they dissented.",
  alternates: { canonical: "/supreme-court/justices" },
  openGraph: {
    ...topicOg("supreme-court/justices"),
    title: `Who has sat on the Supreme Court? · ${site.name}`,
    description: "Every Supreme Court justice since the 1937 term, with the length of their tenure, their appointing president and their record.",
    url: "/supreme-court/justices",
  },
  twitter: topicTwitter("supreme-court/justices"),
};

const linkClass = "font-medium text-accent underline decoration-line-strong underline-offset-2 hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export default function JusticesPage() {
  const { rows, asOf } = getJusticeDirectory();
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-16 pt-7 sm:px-6">
      <PageHeader eyebrow="Supreme Court · Justices" title="Who Has Sat on the Supreme Court?">
        <p>
          Every justice who has sat on the Court from the 1937 term on, {rows.length} in all: the nine on the bench today, how long each served, who appointed them, and how often they wrote the Court&rsquo;s opinion or dissented. A name opens that justice&rsquo;s profile.
        </p>
        <PageShortcuts>
          <p>
            <a href="#all-justices" className={linkClass}>
              Browse all {rows.length} justices ↓
            </a>
          </p>
        </PageShortcuts>
      </PageHeader>

      <CurrentCourt rows={rows} />
      <TenureTimeline rows={rows} asOf={asOf} />
      <div id="all-justices" className="scroll-mt-6">
        <DirectoryTable rows={rows} />
      </div>

      <UpNext />
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Source: <SourceLink id="fjc">Federal Judicial Center</SourceLink>, Biographical Directory of Article III Federal Judges (service dates, appointments and Senate confirmation votes); <SourceLink id="scdb">Supreme Court Database</SourceLink>, justice-centered, argued cases from the 1946 term (dissents; licensed CC BY-NC 3.0 US); <SourceLink id="martin-quinn">Martin&ndash;Quinn scores</SourceLink>. Portraits: public-domain images via <SourceLink id="wikipedia">Wikipedia</SourceLink>.
      </p>
    </main>
  );
}
