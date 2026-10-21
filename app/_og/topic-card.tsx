import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sparkPath, thin } from "@/lib/og-sparkline";
import { topicCard, type OgBranch, type TopicPath } from "@/lib/og-topics";
import { site } from "@/lib/site";

/**
 * The share card for a topic page: the page's eyebrow and `<h1>` question, its
 * headline figure (from `lib/og-topics.ts`, read through the page's own loaders) and a
 * sparkline of the series behind it, on the branch's deep colour. Each topic page's
 * `opengraph-image.tsx` and `twitter-image.tsx` is a three-line call to this, so the
 * look lives in one place. Same 1200×630 and Newsreader serif as `app/opengraph-image.tsx`.
 */

export const TOPIC_OG_SIZE = { width: 1200, height: 630 };

/** Deep branch colours (ARCHITECTURE_MAP rule 11a), darkened a step so white type reads at thumbnail size. */
const BG: Record<OgBranch, string> = {
  presidency: "#162b4f",
  congress: "#20493a",
  "supreme-court": "#5a2029",
  timeline: "#22262e",
};
const INK = "#ffffff";
const MUTED = "rgba(255,255,255,0.72)";
const GOLD = "#e8c877";

const SPARK_W = 470;
const SPARK_H = 190;

export async function topicImage(path: TopicPath): Promise<ImageResponse> {
  const c = topicCard(path);
  const dir = join(process.cwd(), "app/_og");
  const [serif] = await Promise.all([readFile(join(dir, "Newsreader.ttf"))]);
  const spark = c.strip ? null : sparkPath(thin(c.series), SPARK_W, SPARK_H, 8);
  const figureSize = c.figure.length <= 6 ? 150 : c.figure.length <= 9 ? 124 : c.figure.length <= 13 ? 104 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG[c.branch],
          padding: "56px 72px 52px",
          color: INK,
          fontFamily: "Newsreader",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>{site.name}</div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: GOLD, textTransform: "uppercase" }}>
            {c.eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: c.title.length > 40 ? 52 : 60, lineHeight: 1.08, letterSpacing: -1, marginTop: 8 }}>{c.title}</div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: figureSize, lineHeight: 1, letterSpacing: -3, color: GOLD }}>{c.figure}</div>
            <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3, color: MUTED, marginTop: 16 }}>{c.caption}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: SPARK_W, flexShrink: 0 }}>
            {spark ? (
              <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
                <path d={spark.area} fill="rgba(232,200,119,0.16)" />
                <path d={spark.line} fill="none" stroke={GOLD} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={spark.end.x} cy={spark.end.y} r={8} fill={GOLD} />
              </svg>
            ) : (
              <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
                <rect x={0} y={SPARK_H / 2 - 36} width={SPARK_W} height={72} fill="rgba(255,255,255,0.12)" />
                {(c.strip ?? []).map((s) => (
                  <rect key={s.x} x={s.x * SPARK_W} y={SPARK_H / 2 - 36} width={s.w * SPARK_W + 0.5} height={72} fill={s.color} />
                ))}
              </svg>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: MUTED, marginTop: 8 }}>
              <span>{c.from}</span>
              <span>{c.to}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...TOPIC_OG_SIZE,
      fonts: [{ name: "Newsreader", data: serif, weight: 500, style: "normal" }],
    },
  );
}

/** Alt text for a topic page's share image. */
export function topicAlt(path: TopicPath): string {
  const c = topicCard(path);
  return `${c.title} ${c.figure}: ${c.caption}. ${site.name}`;
}
