import Link from "next/link";
import { ChartCard } from "@/components/charts/ChartCard";
import { courtTakeaway, benchOrder, type DirectoryRow } from "@/lib/justice-directory";
import { justicePath } from "@/lib/justice-url";

const partyVar = (p: "D" | "R") => (p === "D" ? "var(--dem)" : "var(--rep)");

/**
 * The sitting Court as it sits on the bench: nine portrait cards in one row from `md` (Chief Justice in the middle, then the
 * associate justices alternating outward by seniority, `benchOrder`), and a 3 × 3 block on phones, where the same order puts
 * the Chief in the centre cell. Each card links to the profile.
 */
export function CurrentCourt({ rows }: { rows: readonly DirectoryRow[] }) {
  const seats = benchOrder(rows);
  return (
    <ChartCard title="The Court today" takeaway={courtTakeaway(rows)}>
      <ol aria-label="The sitting justices, in bench order from left to right" className="m-0 grid list-none grid-cols-3 gap-x-2 gap-y-3 p-0 md:grid-cols-9 md:gap-x-2.5">
        {seats.map((r) => (
          <li key={r.id} className="min-w-0">
            <Link
              href={justicePath(r)}
              className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="relative block aspect-[3/4] overflow-hidden rounded-md border border-line-strong bg-surface-raised">
                {r.photoSrc ? (
                  // Pre-sized static assets from public/; see JusticeHeader for why this is not next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoSrc} alt="" width={330} height={440} className="size-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]" />
                ) : (
                  <span aria-hidden className="flex size-full items-center justify-center font-serif text-2xl text-ink-faint">
                    {r.short[0]}
                  </span>
                )}
                {/* The party stripe is the appointing president's, the same colour the timeline bars use. */}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1" style={{ background: partyVar(r.party) }} />
              </span>
              <span className="mt-1.5 block font-serif text-[0.95rem] font-medium leading-tight text-ink group-hover:underline group-hover:underline-offset-2 md:text-[0.85rem] lg:text-[0.95rem]">
                {r.name.split(" ").slice(1).join(" ")}
              </span>
              <span className="block font-mono text-[0.62rem] uppercase leading-snug tracking-[0.06em] text-ink-faint">
                {r.chiefNow ? (
                  <>
                    Chief<span className="md:max-lg:sr-only"> Justice</span>
                  </>
                ) : (
                  "Justice"
                )}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[0.72rem] leading-snug text-ink-muted md:max-lg:text-[0.64rem]">
                <span aria-hidden className="mr-1 inline-block size-[0.5rem] rounded-full align-baseline" style={{ background: partyVar(r.party) }} />
                <span className="sr-only">{r.party === "D" ? "Democratic" : "Republican"} appointee: </span>
                {r.presidentShort}
              </span>
              <span className="block text-[0.72rem] leading-snug text-ink-faint">Since {r.start.slice(0, 4)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </ChartCard>
  );
}
