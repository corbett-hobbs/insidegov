import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HubSectionList } from "@/components/HubSectionList";
import type { Branch } from "@/lib/verticals";

/**
 * One branch on the homepage: a full-width card in the branch's colour, laid out
 * as a title across the top, then the blurb + chart + headline stat on the left
 * and every page of the branch as rows on the right (rows share the card's
 * height evenly). Light-on-colour tokens are scoped in globals.css
 * (`.home-card`), so the charts and the section list inside render unchanged.
 * `grow` lets the chart panel take the height the list sets (the Presidency
 * chart); otherwise the panel is its chart's own height.
 */
export function HomeBranchCard({
  branch,
  numeral,
  kicker,
  blurb,
  viz,
  stat,
  grow = false,
  index,
}: {
  branch: Branch;
  numeral: string;
  kicker: string;
  blurb: string;
  viz: ReactNode;
  stat: ReactNode;
  grow?: boolean;
  index: number;
}) {
  const first = `${branch.href}/${branch.defaultSection}`;
  return (
    <section
      data-branch={branch.id}
      aria-labelledby={`hub-${branch.id}`}
      className="home-card home-reveal overflow-hidden rounded-2xl"
      style={{ "--i": index } as CSSProperties}
    >
      <div className="grid gap-x-11 gap-y-5 p-6 lg:grid-cols-[5fr_7fr] lg:grid-rows-[auto_1fr] lg:p-8 lg:[grid-template-areas:'head_list'_'left_list']">
        <div className="flex flex-col gap-2 lg:[grid-area:head]">
          <div className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-accent">
            {numeral} · {kicker}
          </div>
          <h2 id={`hub-${branch.id}`} className="font-serif text-[2.1rem] font-medium leading-[1.05] tracking-tight">
            <Link href={first} className="home-sweep">
              {branch.label}
            </Link>
          </h2>
        </div>

        <div className="flex flex-col gap-4 lg:[grid-area:left]">
          <p className="text-[0.95rem] leading-relaxed text-ink-muted">{blurb}</p>
          <div className={`relative rounded-xl bg-white/10 p-3.5 ${grow ? "flex flex-1 flex-col" : ""}`}>{viz}</div>
          <div className="mt-auto flex flex-col gap-1">{stat}</div>
        </div>

        <div className="lg:[grid-area:list]">
          <HubSectionList
            sections={branch.sections}
            stacked
            fill
            className={grow ? "" : "lg:py-12"}
          />
        </div>
      </div>
    </section>
  );
}
