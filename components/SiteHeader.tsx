"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteNav, SiteSectionNav } from "./SiteNav";
import { SiteSearch } from "./SiteSearch";
import { useBackLinkHref } from "./BackLinkContext";
import { branches, liveSections } from "@/lib/verticals";
import { STATIC_PAGES } from "@/lib/site-info";

/** Pages where the primary nav is itself the way around: the wordmark is a
 *  plain link to "/" with no arrow. Every other page is a detail page. */
const SECTION_PAGES = new Set<string>([
  "/",
  ...STATIC_PAGES,
  ...liveSections().map((s) => s.href),
]);

/**
 * One header row at `md`+ (two slim rows below): wordmark, branch tabs
 * (SiteNav), then — on any live vertical's pages, even with one section — a
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

  return (
    <header data-branch={branch} className="border-b border-line bg-surface">
      <div className="relative mx-auto flex w-full max-w-[1180px] flex-wrap items-stretch md:h-14 md:flex-nowrap md:px-6">
        <Link
          href={isDetail ? backHref : "/"}
          title={isDetail ? "Back to InsideGov" : undefined}
          className="group flex h-12 flex-none items-center gap-1.5 whitespace-nowrap pl-4 pr-1 pt-[5px] font-serif text-[1.3rem] font-semibold tracking-tight text-ink md:mr-8 md:h-auto md:flex-none md:pl-0 md:pt-[5px] md:text-[1.35rem]"
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
        ) : (
          <SiteNav />
        )}
        <SiteSectionNav />
        {isHome && <SiteSearch />}
      </div>
    </header>
  );
}
