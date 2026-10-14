import Link from "next/link";
import type { Branch } from "@/lib/verticals";

const ROMAN = ["I", "II", "III"];

/**
 * The three branches as an index along the bottom of the hero: numeral, name,
 * and a line saying how many pages are inside and what the first few are
 * (derived from lib/verticals.ts). Each entry is a link to the branch's first page.
 */
export function BranchStrip({ items }: { items: readonly Branch[] }) {
  return (
    <nav
      aria-label="The three branches"
      className="home-strip relative z-10 border-t border-[#e8c877]/55 backdrop-blur-md"
    >
      <ul className="mx-auto grid w-full max-w-[1180px] px-4 sm:px-6 md:grid-cols-3">
        {items.map((b, i) => {
          const live = b.sections.filter((s) => s.status === "live");
          const meta = live
            .slice(0, 2)
            .map((s) => s.label)
            .join(", ");
          return (
            <li
              key={b.id}
              className="home-st group/li md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-white/20"
              style={{ "--i": 5 + i } as React.CSSProperties}
            >
              <Link
                href={`${b.href}/${b.defaultSection}`}
                data-branch={b.id}
                className="home-strip-item group relative flex items-center gap-4 border-b border-white/15 py-5 transition-colors hover:bg-white/[0.07] md:border-b-0 md:px-7 md:py-6 md:group-first/li:pl-0 md:group-last/li:pr-0"
              >
                <span aria-hidden="true" className="home-strip-bar" />
                <span aria-hidden="true" className="w-5 font-mono text-[0.75rem] tracking-[0.12em] text-[#e8c877]">
                  {ROMAN[i]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[1.55rem] font-medium leading-tight tracking-tight text-white">
                    <span className="home-sweep">{b.label}</span>
                  </span>
                  <span className="mt-1.5 block truncate font-mono text-[0.68rem] uppercase tracking-[0.1em] text-[#b9c6e2]">
                    {live.length} {live.length === 1 ? "page" : "pages"} · {meta}
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
