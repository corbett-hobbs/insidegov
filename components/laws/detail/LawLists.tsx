import Link from "next/link";
import type { LawRelatedEntry } from "@/lib/law-details-types";
import { LINK } from "./LawPeople";

const BADGE = "inline-flex items-center rounded-full border border-line-strong px-2 py-px text-[0.68rem] font-medium text-ink-muted";
const LIST = "touch-scroll m-0 max-h-[16rem] list-none overflow-y-auto overscroll-contain rounded-md border border-line p-0";

/** Related bills: label, title, how related; a public law links to its page here, any other bill to Congress.gov. */
export function RelatedList({ related }: { related: readonly LawRelatedEntry[] }) {
  return (
    <ul tabIndex={0} aria-label="Related bills, scrollable" className={LIST}>
      {related.map((r) => (
        <li key={r.label} className="border-b border-line px-3 py-2 text-[0.82rem] leading-[1.45] last:border-b-0">
          <p className="m-0">
            {r.lawPath ? (
              <Link href={r.lawPath} className={`${LINK} font-medium`}>
                {r.label}
              </Link>
            ) : r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className={`${LINK} font-medium`}>
                {r.label}
              </a>
            ) : (
              <span className="font-medium text-ink">{r.label}</span>
            )}
            {r.lawLabel && <span className="text-ink-faint">{` · became ${r.lawLabel}`}</span>}
            {r.rel.map((x) => (
              <span key={x} className={`${BADGE} ml-2 whitespace-nowrap`}>
                {x}
              </span>
            ))}
          </p>
          {r.title && <p className="m-0 mt-0.5 text-ink-muted">{r.title}</p>}
        </li>
      ))}
    </ul>
  );
}
