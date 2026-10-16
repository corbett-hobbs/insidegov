import { forwardRef, type CSSProperties, type ReactNode } from "react";

interface ChartCardProps {
  title: ReactNode;
  /** A muted description under the title (pages not yet moved to takeaways). */
  lede?: ReactNode;
  /** What the chart shows, in one or two sentences, in ink (ARCHITECTURE_MAP rule 7c). Use instead of `lede`. */
  takeaway?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * The explorer's card chrome: serif title with an optional action (search box,
 * sort toggle) on the same row, a takeaway (or, on older pages, a muted lede)
 * beneath, then the body. Shared by the
 * Congress explorer (components/senate/SenateExplorer.tsx) and the Supreme
 * Court explorer (components/court/CourtExplorer.tsx).
 */
export const ChartCard = forwardRef<HTMLElement, ChartCardProps>(function ChartCard({
  title,
  lede,
  takeaway,
  action,
  className,
  style,
  children,
}, ref) {
  return (
    <section
      ref={ref}
      style={style}
      className={`flex flex-col rounded-[10px] border border-line bg-surface p-[1.35rem_1.35rem_1.1rem] ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-serif text-[1.05rem] font-medium">{title}</h2>
        {action}
      </div>
      {takeaway ? (
        <p className="mb-2 mt-1.5 text-[0.875rem] leading-[1.5] text-ink">{takeaway}</p>
      ) : (
        <p className="mb-2 mt-1 text-[0.82rem] leading-[1.5] text-ink-muted">
          {lede}
        </p>
      )}
      {children}
    </section>
  );
});
