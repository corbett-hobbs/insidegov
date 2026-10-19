"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeBranch, activeSection, branches } from "@/lib/verticals";

/**
 * "Up next" band at the foot of every branch section page, so readers move on without scrolling back to the nav.
 * The next live section in the branch; on the branch's last section, the next branch's first page (the last branch
 * hands off to the Timeline). Renders nothing on profile pages, which match no section.
 */
export function UpNext() {
  const pathname = usePathname();
  const branch = activeBranch(pathname);
  if (!branch) return null;
  const current = activeSection(branch, pathname);
  if (!current) return null;

  const live = branch.sections.filter((s) => s.status === "live");
  const i = live.findIndex((s) => s.id === current.id);
  const prev = i > 0 ? live[i - 1] : null;
  const next = live[i + 1];

  let kicker: string;
  let title: string;
  let blurb: string | undefined;
  let href: string;
  let theme = branch.id;
  if (next) {
    kicker = `Up next · ${i + 2} of ${live.length}`;
    ({ label: title, blurb, href } = next);
  } else {
    const nb = branches[branches.indexOf(branch) + 1]?.status === "live" ? branches[branches.indexOf(branch) + 1] : undefined;
    if (nb) {
      const first = nb.sections.find((s) => s.id === nb.defaultSection);
      theme = nb.id;
      kicker = `Next branch · ${nb.label}`;
      title = first?.label ?? nb.label;
      blurb = first?.blurb;
      href = `${nb.href}/${nb.defaultSection}`;
    } else {
      theme = "timeline";
      kicker = "Next branch · Timeline";
      title = "Timeline";
      blurb = "Who held power, 1933 to now.";
      href = "/timeline";
    }
  }

  return (
    <nav aria-label="Up next" className="w-full">
      <div data-branch={theme}>
      <Link
        href={href}
        className="group flex items-center gap-4 rounded-b-lg border-t-[3px] border-accent bg-accent px-5 py-5 text-accent-ink no-underline transition-opacity hover:opacity-90 sm:px-6"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.12em] opacity-80">{kicker}</span>
          <span className="font-serif text-2xl leading-tight sm:text-[1.7rem]">{title}</span>
          {blurb && <span className="text-[0.85rem] leading-snug opacity-85">{blurb}</span>}
        </span>
        <span aria-hidden="true" className="ml-auto flex-none text-3xl transition-transform group-hover:translate-x-1">→</span>
      </Link>
      </div>
      <div className="flex justify-between px-1 pt-2 text-[0.8rem] text-ink-muted">
        {prev ? <Link href={prev.href} className="hover:underline">← {prev.label}</Link> : <span />}
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:underline">Back to top ↑</a>
      </div>
    </nav>
  );
}
