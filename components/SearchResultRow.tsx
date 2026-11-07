import { MemberPhoto } from "@/components/MemberPhoto";
import { CommitteeSeal } from "@/components/committee/CommitteeSeal";
import type { SearchKind } from "@/lib/site-search";

/**
 * The leading thumbnail of a search result: a photo for people, the committee
 * seal for committees, a line-chart glyph for pages. Shared by the homepage
 * search and the Members page's phone name search so the two read the same.
 */
export function SearchThumb({ kind, image }: { kind: SearchKind; image?: string }) {
  if (kind === "committee") return <CommitteeSeal chamber={image === "senate" || image === "joint" ? image : "house"} size={24} showOnMobile />;
  if (kind === "page") {
    return (
      <span aria-hidden className="flex size-6 flex-none items-center justify-center rounded-md bg-surface-raised text-ink-faint">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2v12h12" />
          <path d="M4.5 10l3-3.5 2.5 2L13 4.5" />
        </svg>
      </span>
    );
  }
  return <ResultFace image={image} />;
}

function ResultFace({ image }: { image?: string }) {
  return (
    // Pre-sized static assets from public/ (see MemberPhoto).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image || "/images/member-placeholder.svg"} alt="" loading="lazy" decoding="async" className="h-7 w-[1.4rem] flex-none rounded-[3px] bg-surface-raised object-cover object-top" />
  );
}

/** A member row for a list that isn't the site search: same layout, fed straight from a directory member. */
export function MemberFaceThumb({ bioguideId, hasPhoto }: { bioguideId: string; hasPhoto: boolean }) {
  return <MemberPhoto bioguideId={bioguideId} hasPhoto={hasPhoto} size="small" className="h-7 w-[1.4rem] flex-none rounded-[3px] bg-surface-raised object-cover object-top" />;
}
