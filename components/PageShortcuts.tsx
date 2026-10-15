import type { ReactNode } from "react";

/**
 * The one row of page-level shortcuts and toggles that closes a `PageHeader`, after the intro paragraph and the
 * `HowToRead` disclosure: a "Browse all N …" jump link, and on the Laws page the party-control checkbox. Wraps on a phone.
 */
export function PageShortcuts({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-8 gap-y-2 [&>p]:m-0">{children}</div>;
}
