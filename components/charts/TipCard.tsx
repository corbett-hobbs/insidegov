import type { ReactNode } from "react";

/** One row of a tooltip: optional colour swatch, name, right-aligned mono value. */
export interface TipRowData {
  key: string;
  label: string;
  value: string;
  /** Swatch colour (a CSS colour or token); omit for a row with no series, like "Ceiling". */
  color?: string;
}

const RULE = "1px solid color-mix(in oklab, var(--bg) 30%, transparent)";

/**
 * The standard content of a chart tooltip (ARCHITECTURE_MAP rule 6b): the label on the left and the headline value on
 * the right, one muted line under it, then rows of swatch / name / value. Render it inside `<Tooltip>`; the box sizes
 * to its widest row (`tt-wide`) and the shared `Tooltip` keeps it inside the viewport, so nothing hand-positions it.
 */
export function TipCard({ title, value, sub, rows = [], extra = [] }: { title: string; value?: string; sub?: ReactNode; rows?: TipRowData[]; extra?: TipRowData[] }) {
  return (
    <div className="tt-wide">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontWeight: 600 }}>
        <span>{title}</span>
        {value !== undefined && <span className="tt-mono" style={{ opacity: 1 }}>{value}</span>}
      </div>
      {sub && <div className="tt-mono">{sub}</div>}
      {rows.length > 0 && <TipRows rows={rows} divided />}
      {extra.length > 0 && <TipRows rows={extra} divided />}
    </div>
  );
}

function TipRows({ rows, divided }: { rows: TipRowData[]; divided?: boolean }) {
  return (
    <div style={{ marginTop: 4, paddingTop: divided ? 4 : 0, borderTop: divided ? RULE : undefined }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span>
            {r.color && <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 6, background: r.color, outline: "1px solid color-mix(in oklab, var(--bg) 40%, transparent)" }} />}
            {r.label}
          </span>
          <span className="tt-mono" style={{ opacity: 1 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
