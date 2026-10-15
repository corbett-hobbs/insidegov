import type { ReactNode } from "react";
import { SOURCE_LINKS, type SourceId } from "@/lib/source-links";

/**
 * A source named inside a Data note or page footnote, linked to the page or
 * document it came from. Pass `id` (an entry in `lib/source-links.ts`) or,
 * for an address that comes from the data itself, `href`. The text is the
 * note's own wording; the link never changes it. Opens in a new tab.
 */
export function SourceLink({
  id,
  href,
  children,
}: { children: ReactNode } & ({ id: SourceId; href?: undefined } | { href: string; id?: undefined })) {
  return (
    <a
      href={id ? SOURCE_LINKS[id] : href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </a>
  );
}
