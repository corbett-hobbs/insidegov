import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#e8c877";

/**
 * Share card that mirrors the homepage hero: the Capitol under the navy-to-gold
 * wash (pre-baked into `_og/hero-bg.jpg`, since the image renderer has no blend
 * modes), the serif wordmark, kicker and headline. Keep the copy in step with
 * `app/page.tsx`'s hero.
 */
export default async function OpengraphImage() {
  const dir = join(process.cwd(), "app/_og");
  const [bg, serif, serifItalic] = await Promise.all([
    readFile(join(dir, "hero-bg.jpg")),
    readFile(join(dir, "Newsreader.ttf")),
    readFile(join(dir, "Newsreader-Italic.ttf")),
  ]);
  const bgSrc = `data:image/jpeg;base64,${bg.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          background: "#142748",
          padding: "64px 80px",
          color: "#fff",
          fontFamily: "Newsreader",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse, not a page */}
        <img
          src={bgSrc}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        <div style={{ display: "flex", fontSize: 52, fontWeight: 600, letterSpacing: -1 }}>
          {site.name}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 4,
              color: GOLD,
              fontFamily: "monospace",
              textTransform: "uppercase",
            }}
          >
            {site.tagline}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 104,
              lineHeight: 1.02,
              letterSpacing: -2,
              marginTop: 18,
            }}
          >
            <div style={{ display: "flex" }}>Three branches.</div>
            <div style={{ display: "flex", fontStyle: "italic" }}>One public record.</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: serif, weight: 500, style: "normal" },
        { name: "Newsreader", data: serifItalic, weight: 500, style: "italic" },
      ],
    },
  );
}
