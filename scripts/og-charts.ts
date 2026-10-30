/**
 * `pnpm og:charts`: the link-preview image for every chart on the site (see `lib/og-charts.ts`).
 *
 * Needs a built site (`pnpm build`) and Playwright's Chromium (`pnpm exec playwright install chromium`). It starts
 * `next start`, opens each page in `CHART_PAGES`, finds every chart card (the ones with a Share button), then opens
 * the card's embed view (`?embed=<id>`, `lib/embed.ts`: the card alone, default filters) and screenshots it onto a
 * 1200x630 branded canvas: `public/og-charts/<page>/<id>.png`. It also writes `lib/og-charts.json`, the list of charts
 * per page that the share menu and the `<page>/chart/[chart]` routes read. Re-run after a data refresh so the images
 * match the page.
 *
 *   pnpm og:charts                       every page
 *   pnpm og:charts /presidency/trade     only these pages (the manifest keeps the others)
 *   pnpm og:charts --base http://localhost:3000   use a running server instead of starting one
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { CHART_PAGES, chartSlug, type ChartEntry } from "../lib/og-charts";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/og-charts");
const MANIFEST = join(ROOT, "lib/og-charts.json");

const W = 1200;
const H = 630;
const NAVY = "#162b4f";
const HEAD = 70; // wordmark band above the chart
const PAD = 40;
const BOX_W = W - PAD * 2;
const BOX_H = H - HEAD - 26;
/** A card taller than this (width / height) is cut from the top before fitting, so a long list stays legible. */
const MIN_ASPECT = 1.6;

const args = process.argv.slice(2);
const baseArg = args.indexOf("--base");
const BASE_GIVEN = baseArg >= 0 ? args[baseArg + 1]! : null;
const only = args.filter((a, i) => a.startsWith("/") && args[i - 1] !== "--base");
const PORT = 3217;

async function startServer(): Promise<ChildProcess | null> {
  if (BASE_GIVEN) return null;
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error("next start did not come up (run `pnpm build` first)");
}

/** Scroll the page through so lazily mounted cards exist, then wait for the Share buttons to settle. */
async function discover(page: Page, base: string, path: string): Promise<ChartEntry[]> {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  let seen = -1;
  for (let i = 0; i < 20; i++) {
    const n = await page.locator("[data-share-slot]").count();
    if (n === seen) break;
    seen = n;
    await page.waitForTimeout(400);
  }
  return page.evaluate(() => {
    const out: { id: string; title: string }[] = [];
    for (const slot of Array.from(document.querySelectorAll<HTMLElement>("[data-share-slot]"))) {
      const card = slot.closest<HTMLElement>("[data-chart-card], section, article");
      const heading = slot.closest<HTMLElement>("h2, h3");
      if (!card?.id || !heading) continue;
      // Years and "so far" dropped, like the card's anchor, so the title survives the next data year.
      const title = (heading.textContent ?? "").trim().replace(/,? (\d{4}|so far)( so far)?(?=$|,)/g, "").trim();
      if (!out.some((c) => c.id === card.id)) out.push({ id: card.id, title });
    }
    return out;
  });
}

async function shoot(page: Page, base: string, path: string, id: string): Promise<Buffer> {
  await page.goto(`${base}${path}?embed=${encodeURIComponent(id)}&theme=light`, { waitUntil: "networkidle" });
  await page.waitForSelector("html[data-embed-ready]", { timeout: 20_000 });
  await page.addStyleTag({ content: ".embed-credit{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  return page.locator("[data-embed-card]").screenshot({ type: "png" });
}

async function compose(shot: Buffer): Promise<Buffer> {
  let img = sharp(shot);
  const meta = await img.metadata();
  const w = meta.width!;
  let h = meta.height!;
  if (w / h < MIN_ASPECT) {
    h = Math.floor(w / MIN_ASPECT);
    img = sharp(await img.extract({ left: 0, top: 0, width: w, height: h }).toBuffer());
  }
  const scale = Math.min(BOX_W / w, BOX_H / h);
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  const radius = Buffer.from(`<svg width="${tw}" height="${th}"><rect width="${tw}" height="${th}" rx="12" fill="#fff"/></svg>`);
  const chart = await img.resize(tw, th, { kernel: "lanczos3" }).composite([{ input: radius, blend: "dest-in" }]).png().toBuffer();
  const brand = Buffer.from(
    `<svg width="${W}" height="${HEAD}"><text x="${PAD}" y="48" font-family="Newsreader, Georgia, 'DejaVu Serif', serif" font-size="34" font-weight="600" fill="#fff">InsideGov</text>` +
      `<text x="${W - PAD}" y="46" text-anchor="end" font-family="Newsreader, Georgia, 'DejaVu Serif', serif" font-size="22" letter-spacing="2" fill="#e8c877">INSIDEGOV.FYI</text></svg>`,
  );
  return sharp({ create: { width: W, height: H, channels: 3, background: NAVY } })
    .composite([
      { input: brand, left: 0, top: 0 },
      { input: chart, left: Math.round((W - tw) / 2), top: HEAD + Math.round((BOX_H - th) / 2) },
    ])
    .png({ palette: true, quality: 90 })
    .toBuffer();
}

async function main() {
  const manifest: { pages: Record<string, ChartEntry[]> } = JSON.parse(await readFile(MANIFEST, "utf8"));
  const pages = only.length ? CHART_PAGES.filter((p) => only.includes(p)) : [...CHART_PAGES];
  const server = await startServer();
  const base = BASE_GIVEN ?? `http://localhost:${PORT}`;
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const path of pages) {
      const charts = await discover(page, base, path);
      const dir = join(OUT, chartSlug(path));
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      const kept: ChartEntry[] = [];
      for (const c of charts) {
        try {
          await writeFile(join(dir, `${c.id}.png`), await compose(await shoot(page, base, path, c.id)));
          kept.push(c);
        } catch (e) {
          console.warn(`  skipped ${path}#${c.id}: ${(e as Error).message.split("\n")[0]}`);
        }
      }
      manifest.pages[path] = kept;
      console.log(`${path}: ${kept.length}/${charts.length} charts`);
    }
    for (const p of Object.keys(manifest.pages)) if (!(CHART_PAGES as readonly string[]).includes(p)) delete manifest.pages[p];
    const sorted = Object.fromEntries(CHART_PAGES.filter((p) => manifest.pages[p]).map((p) => [p, manifest.pages[p]!]));
    await writeFile(MANIFEST, `${JSON.stringify({ pages: sorted }, null, 2)}\n`);
  } finally {
    await browser?.close();
    server?.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
