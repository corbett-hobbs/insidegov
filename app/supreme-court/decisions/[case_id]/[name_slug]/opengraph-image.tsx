import { ImageResponse } from "next/og";
import { getDecisionPage } from "@/lib/decision-page-data";
import { isCaseId } from "@/lib/decision-url";
import { longDate } from "@/lib/law-details-derive";
import { site } from "@/lib/site";

export const alt = "A U.S. Supreme Court decision";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered on first request and then cached: there are 8k cases and link previews are rarely the first hit.

const BG = "#14161c";
const INK = "#e9eaee";
const INK_MUTED = "#9aa2af";
const ACCENT = "#9b84c7";

export default async function Image({ params }: { params: Promise<{ case_id: string }> }) {
  const { case_id } = await params;
  const d = isCaseId(case_id) ? getDecisionPage(case_id) : null;

  if (!d) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BG, color: INK, fontSize: 48, fontFamily: "sans-serif" }}>{site.name}</div>,
      size,
    );
  }

  const title = d.name.length > 150 ? `${d.name.slice(0, 147)}…` : d.name;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 4, color: ACCENT, fontWeight: 600 }}>{`SUPREME COURT · ${d.vote.maj}–${d.vote.min}`}</div>
          <div style={{ fontSize: title.length > 90 ? 48 : 64, color: INK, fontWeight: 700, marginTop: 14, lineHeight: 1.1 }}>{title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: INK_MUTED }}>
          <span>{[d.cite, d.court, longDate(d.decided)].filter(Boolean).join(" · ")}</span>
          <span>{site.name}</span>
        </div>
      </div>
    ),
    size,
  );
}
