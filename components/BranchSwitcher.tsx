"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { activeSection, branches, type Branch } from "@/lib/verticals";
import { CROSS_BRANCH_PAGES } from "@/lib/site-info";

/**
 * Desktop (`md`+) header switcher: "Presidency ▾" beside the wordmark. It opens
 * a map of the whole site — one column per branch with every page, the current
 * branch tinted and the current page marked — plus the cross-branch pages and
 * Home. Closes on Esc, a click outside, or navigation. On the cross-branch
 * Timeline pass `label` instead of `branch`: the same button with a
 * slate chip (the Timeline theme) naming the page, and no column tinted.
 * Mock: docs/mockups/subpage-nav/option-b.html.
 */
export function BranchSwitcher({ branch, label }: { branch?: Branch; label?: string }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (o: boolean) => setOpenOn(o ? pathname : null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} data-nav-branch={branch ? undefined : "timeline"} className="relative hidden flex-none items-center md:flex">
      <span aria-hidden className="mr-2.5 ml-3 font-sans text-[1.6rem] font-light text-line-strong min-[1100px]:mr-3 min-[1100px]:ml-3.5">
        /
      </span>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-2.5 whitespace-nowrap rounded-md border border-line bg-surface-raised px-2.5 font-mono text-[0.8rem] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:border-ink aria-expanded:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span aria-hidden className={`size-2.5 rounded-[2px] bg-[var(--nav-branch)]`} />
        {branch?.label ?? label}
        <span className="sr-only">: show all pages</span>
        <span aria-hidden className={`text-[0.65rem] tracking-normal text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-[calc(100%+8px)] -left-px z-50 w-[min(760px,calc(100vw-48px))] rounded-[10px] border border-line bg-surface px-2 pt-4 pb-2 shadow-[0_14px_40px_rgba(20,30,50,0.18)]"
        >
          <nav aria-label="All pages" className="grid grid-cols-[1.15fr_1fr_1fr] gap-1">
            {branches.map((b) => (
              <MapColumn key={b.id} branch={b} current={b.id === branch?.id} pathname={pathname} />
            ))}
          </nav>
          <div className="mx-1 mt-1.5 flex items-center gap-3 border-t border-line px-3 py-2.5 text-[0.86rem] text-ink-muted">
            Across all three branches:
            {CROSS_BRANCH_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="flex items-center gap-2 font-semibold text-ink hover:underline">
                <span aria-hidden className="size-2.5 rounded-[2px] bg-ink-muted" />
                {p.label}: who held power when it happened →
              </Link>
            ))}
            <Link href="/" className="ml-auto font-medium hover:text-ink hover:underline">
              Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MapColumn({ branch, current, pathname }: { branch: Branch; current: boolean; pathname: string }) {
  const here = current ? activeSection(branch, pathname) : undefined;
  return (
    <div data-nav-branch={branch.id} className={`rounded-lg px-2.5 pt-0.5 pb-2.5 ${current ? "bg-[var(--nav-branch-wash)]" : ""}`}>
      {branch.status === "live" ? (
        <Link
          href={branch.href}
          className="mb-1 flex items-center gap-2 border-b-2 border-[var(--nav-branch)] px-1.5 py-2 font-mono text-[0.76rem] font-semibold uppercase tracking-[0.12em] text-ink"
        >
          <span aria-hidden className="size-2.5 rounded-[2px] bg-[var(--nav-branch)]" />
          {branch.label}
          <span className="ml-auto font-normal tracking-[0.06em] text-ink-faint">
            {branch.sections.length}
            <span className="sr-only"> pages</span>
          </span>
        </Link>
      ) : (
        <span className="mb-1 flex items-center gap-2 border-b-2 border-line px-1.5 py-2 font-mono text-[0.76rem] uppercase tracking-[0.12em] text-ink-faint">
          {branch.label}
        </span>
      )}
      <ul>
        {branch.sections.map((s) =>
          s.status === "live" ? (
            <li key={s.id}>
              <Link
                href={s.href}
                aria-current={here?.id === s.id ? "page" : undefined}
                className={`flex items-center rounded-[5px] px-2 py-1.5 text-[0.9rem] font-medium transition-colors hover:text-ink ${
                  current ? "hover:bg-surface" : "hover:bg-surface-raised"
                } ${here?.id === s.id ? "font-semibold text-ink shadow-[inset_3px_0_0_var(--nav-branch)]" : "text-ink-muted"}`}
              >
                {s.label}
              </Link>
            </li>
          ) : (
            <li key={s.id} className="px-2 py-1.5 text-[0.9rem] text-ink-faint">
              {s.label} <span className="text-[0.75rem]">(soon)</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
