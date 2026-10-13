"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The "See methodology" disclosure under a chart. Collapsed by default
 * on every screen size. The last line links to the contact form with the
 * current page prefilled.
 */
export function MethodologyNote({
  children,
  label = "Data notes",
  className = "mt-3",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <details className={className}>
      <summary className="cursor-pointer text-[0.75rem] text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {label}
      </summary>
      <div className="m-0 mt-1.5 text-[0.75rem] leading-[1.45] text-ink-muted [&>p]:m-0 [&>p+p]:mt-2">{children}
        <p>
          <Link
            href={`/contact?topic=correction&page=${encodeURIComponent(pathname)}`}
            className="underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Report a correction
          </Link>
        </p>
      </div>
    </details>
  );
}
