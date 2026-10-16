import Link from "next/link";
import type { Branch } from "@/lib/verticals";

const ROMAN = ["I", "II", "III", "IV"];

/** The cross-branch Timeline, the fourth entry after the three branches. */
const TIMELINE = { id: "timeline", label: "Timeline", href: "/timeline", meta: "Who held power, 1933–now" };

/**
 * The three branches as an index along the bottom of the hero: numeral, name,
 * and a line saying how many pages are inside and what the first few are
 * (derived from lib/verticals.ts). Each entry is a link to the branch's first page.
 */
export function BranchStrip({ items }: { items: readonly Branch[] }) {
  return (
    <nav
      aria-label="The three branches and the timeline"
      className="home-strip relative z-10 border-t border-[#e8c877]/55 backdrop-blur-md"
    >
      <ul className="mx-auto grid w-full max-w-[1180px] px-4 sm:px-6 md:grid-cols-4">
        {[...items.map((b) => ({ id: b.id as string, label: b.label, href: `${b.href}/${b.defaultSection}`, meta: null as string | null, b })), { ...TIMELINE, b: null }].map((e, i) => {
          const live = e.b?.sections.filter((s) => s.status === "live") ?? [];
          const meta =
            e.meta ??
            `${live.length} ${live.length === 1 ? "page" : "pages"} · ${live
              .slice(0, 2)
              .map((s) => s.label)
              .join(", ")}`;
          return (
            <li
              key={e.id}
              className="home-st group/li md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-white/20"
              style={{ "--i": 5 + i } as React.CSSProperties}
            >
              <Link
                href={e.href}
                data-branch={e.id}
                className="home-strip-item group relative flex items-center gap-4 border-b border-white/15 py-5 transition-colors hover:bg-white/[0.07] md:border-b-0 md:px-5 lg:px-7 md:py-6 md:group-first/li:pl-0 md:group-last/li:pr-0"
              >
                <span aria-hidden="true" className="home-strip-bar" />
                <span aria-hidden="true" className="w-5 font-mono text-[0.75rem] tracking-[0.12em] text-[#e8c877]">
                  {ROMAN[i]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[1.55rem] font-medium leading-tight tracking-tight text-white">
                    <span className="home-sweep">{e.label}</span>
                  </span>
                  <span className="mt-1.5 block truncate font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[#b9c6e2]">
                    {meta}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-xl text-[#e8c877] transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
