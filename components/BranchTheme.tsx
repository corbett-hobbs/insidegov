import type { ReactNode } from "react";

/**
 * Wraps a branch's pages (presidency, congress, supreme-court) so their
 * controls pick up that branch's accent: `[data-branch]` in globals.css
 * re-points --accent. Palette only; no layout of its own. The site header gets
 * the same attribute from SiteHeader.
 */
export function BranchTheme({ branch, children }: { branch: string; children: ReactNode }) {
  return (
    <div data-branch={branch} className="relative flex flex-1 flex-col">
      {/* faint duotone landmark behind the top of the page, fading out. */}
      <div aria-hidden="true" className="branch-bg" />
      {children}
    </div>
  );
}
