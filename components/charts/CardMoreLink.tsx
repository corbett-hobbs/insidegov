import Link from "next/link";

/** The quiet "where this comes from" link at the foot of a card, styled as on the president-page cards (`CardShell`'s `more`). */
export function CardMoreLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <p className={`m-0 mt-3 text-right ${className}`.trim()}>
      <Link href={href} className="text-[0.75rem] text-ink-muted underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {label} →
      </Link>
    </p>
  );
}
