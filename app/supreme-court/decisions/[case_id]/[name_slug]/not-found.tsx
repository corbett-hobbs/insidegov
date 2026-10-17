import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Decision not found",
  robots: { index: false },
};

export default function DecisionNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[42rem] flex-1 flex-col justify-center gap-5 px-6 py-24">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-accent">404 · decision</p>
      <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight">No decision with that ID</h1>
      <p className="text-[1.02rem] leading-relaxed text-ink-muted">
        Decision pages cover every orally argued Supreme Court case from the 1946 term on, at an address like /supreme-court/decisions/2021-001. A summary order,
        an earlier term, or a mistyped ID lands here.
      </p>
      <Link href="/supreme-court/decisions" className="font-mono text-[0.8rem] uppercase tracking-[0.1em] text-accent hover:underline">
        ← Browse the decisions
      </Link>
    </main>
  );
}
