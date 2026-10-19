"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteNav, SiteSectionNav } from "./SiteNav";
import { SiteSearch } from "./SiteSearch";
import { useBackLinkHref } from "./BackLinkContext";
import { BranchSwitcher } from "./BranchSwitcher";
import { branches, liveSections, sectionRow } from "@/lib/verticals";
import { CROSS_BRANCH_PAGES, STATIC_PAGES } from "@/lib/site-info";

/** Pages where the primary nav is itself the way around: the wordmark is a
 *  plain link to "/" with no arrow. Every other page is a detail page. */
const SECTION_PAGES = new Set<string>([
  "/",
  ...STATIC_PAGES,
  ...CROSS_BRANCH_PAGES.map((p) => p.href),
  ...liveSections().map((s) => s.href),
]);

/**
 * One header row at `md`+ (two slim rows below): wordmark, branch tabs
 * (SiteNav; on a branch's pages at md+ the BranchSwitcher "/ Presidency ▾"
 * takes their place), then — on any live vertical's pages, even with one section — a
 * divider and the section pills (SiteSectionNav), all left-aligned; the right
 * is empty except on the homepage, which carries the site search (SiteSearch;
 * below md it replaces the branch tabs). Inner pages have no room for it: the
 * section pills fill the row. Each explorer/section renders its
 * own controls below this — e.g. components/senate/ExplorerToolbar.tsx. The
 * header is not sticky; only those toolbars pin.
 *
 * On detail pages (member profiles, committee pages) the wordmark doubles as
 * the back affordance: "← InsideGov", going to whatever the page registered
 * via `SetBackLink` (falls back to "/") — see components/BackLinkContext.tsx.
 * On the hub and section pages it is a plain link to "/".
 */
export function SiteHeader() {
  const pathname = usePathname();
  const backHref = useBackLinkHref();
  const isHome = pathname === "/";
  const isDetail = !SECTION_PAGES.has(pathname);
  const branch = branches.find((b) => b.owns(pathname))?.id;
  // Inside a live branch, md+ swaps the branch tabs for the switcher (phones keep the tabs).
  const row = sectionRow(pathname);
  // The Timeline spans every branch: it gets the switcher too, with a neutral chip and no page row.
  const cross = CROSS_BRANCH_PAGES.find((p) => p.href === pathname);
  const switcher = row || cross;

  return (
    <header data-branch={branch} className="border-b border-line bg-surface">
      <div className="relative mx-auto flex w-full max-w-[1180px] flex-wrap items-stretch md:h-14 md:flex-nowrap md:px-6">
        <Link
          href={isDetail ? backHref : "/"}
          title={isDetail ? "Back to InsideGov" : undefined}
          className={`group flex h-12 flex-none items-center gap-1.5 whitespace-nowrap pl-4 pr-1 font-serif font-semibold tracking-tight text-ink ${switcher ? "md:mr-0" : "md:mr-8"} md:h-auto md:flex-none md:pl-0 md:pt-[5px] md:text-[1.35rem] ${isHome ? "pt-[5px] text-[1.3rem]" : isDetail ? "pt-[3px] text-[min(1.05rem,calc(5.14vw_-_3.08px))]" : "pt-[5px] text-[min(1.3rem,calc(6.4vw_-_3.84px))]"}`}
        >
          {isDetail && (
            <span
              aria-hidden
              className="font-sans text-[0.85em] font-medium text-ink-muted transition-colors group-hover:text-accent"
            >
              ←
            </span>
          )}
          InsideGov
        </Link>
        {isHome ? (
          // On the homepage the body already links to each branch, so below md
          // the search takes the tabs' place in the row.
          <div className="hidden md:contents">
            <SiteNav />
          </div>
        ) : switcher ? (
          // md+: the switcher stands in for the tabs (a branch's colour inside a branch, a neutral chip on
          // the Timeline); phones keep the tabs.
          <>
            <div className="contents md:hidden">
              <SiteNav />
            </div>
            <BranchSwitcher branch={row?.branch} label={cross?.label} />
          </>
        ) : (
          <SiteNav />
        )}
        <SiteSectionNav />
        {isHome && <SiteSearch />}
      </div>
    </header>
  );
}
