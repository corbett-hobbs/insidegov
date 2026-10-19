import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { parse as parseYaml } from "yaml";
import { isPublicDomainLicense } from "./justice-bios";
import { RAW_DIR, run } from "./lib";
import { CONCURRENCY as WIKI_CONCURRENCY, getJson, getSummary, pool as wikiPool, USER_AGENT } from "../wikipedia/client";

/**
 * Official member photos from @unitedstates/images (GitHub Pages, CC0 GPO
 * photos). Keyed by the same `bioguide_id` everything else joins on, so no new
 * crosswalk is needed.
 *
 * Wikipedia first: a current member's lead image on their English Wikipedia
 * article (title from `id.wikipedia` in congress-legislators) is used when its
 * file-page license says public domain or CC0 (official portraits are works of
 * the U.S. government), because it is newer than the GPO set and covers members
 * sworn in since. Anyone without a usable Wikipedia photo falls back to the
 * @unitedstates/images one. The manifest's `wikipedia` list names who got the
 * Wikipedia photo, and `wikipediaSources` the Commons file page for each.
 *
 * Current members only — matches the project's scope everywhere else. Two sizes
 * are committed: 225x275 for the scatter-dot tooltip, 450x550 for the profile
 * page. Fetched here at build time and committed to `public/`, exactly like the
 * ideology data: the app never touches the network at request time.
 *
 * Former members (served in Congress 100+, not in the latest) get the small
 * size only, downscaled to 90x110 (shown at 20x24 in lists and 40x49 in
 * tooltips, so that is already 2x) — thousands of full-size portraits would
 * bloat the repo. They are listed under `former` in the manifest.
 *
 * Missing photos are expected (not every current member has one in the source).
 * Those bioguide ids are recorded in the manifest and the app falls back to a
 * single generic silhouette (`public/images/member-placeholder.svg`).
 *
 * Run after `pnpm transform` — it reads the current roster from
 * `pipeline/output/terms.json`.
 */
const IMAGES_BASE = "https://unitedstates.github.io/images/congress";
const OUT_DIR = "public/images/members";
const MANIFEST = "pipeline/output/member-photos.json";
const TERMS = "pipeline/output/terms.json";

/** File-name suffix -> source size directory. */
const SIZES = { small: "225x275", large: "450x550" } as const;
type SizeKey = keyof typeof SIZES;

const CONCURRENCY = 8;

interface TermRow {
  bioguide_id: string;
  congress_number: number;
  chamber: string;
}

/** Earliest Congress the vote data covers; no point fetching anyone older. */
const FORMER_FROM_CONGRESS = 100;

/** Distinct bioguide ids serving in the latest Congress, sorted, plus former members since FORMER_FROM_CONGRESS. */
async function rosters(): Promise<{ current: string[]; former: string[] }> {
  if (!existsSync(TERMS)) {
    throw new Error(`${TERMS} not found — run \`pnpm transform\` first.`);
  }
  const terms: TermRow[] = JSON.parse(await readFile(TERMS, "utf8"));
  const latest = Math.max(...terms.map((t) => t.congress_number));
  const ids = new Set<string>();
  for (const t of terms) {
    if (t.congress_number === latest) ids.add(t.bioguide_id);
  }
  const former = new Set<string>();
  for (const t of terms) {
    if (t.congress_number >= FORMER_FROM_CONGRESS && !ids.has(t.bioguide_id)) {
      former.add(t.bioguide_id);
    }
  }
  return { current: [...ids].sort(), former: [...former].sort() };
}

/** A real JPEG starts with the SOI marker; guards against 200-with-HTML. */
function isJpeg(buf: Buffer): boolean {
  return buf.length > 1024 && buf[0] === 0xff && buf[1] === 0xd8;
}

const LEGISLATORS = `${RAW_DIR}/congress-legislators/legislators-current.yaml`;

/** bioguide id -> English Wikipedia article title, for current members that have one. */
async function wikipediaTitles(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const e of parseYaml(await readFile(LEGISLATORS, "utf8")) as {
    id?: { bioguide?: string; wikipedia?: string };
  }[]) {
    if (e.id?.bioguide && e.id.wikipedia) out.set(e.id.bioguide, e.id.wikipedia);
  }
  return out;
}

type ImageInfo = { thumburl?: string; extmetadata?: Record<string, { value: string }> };

/**
 * The article's lead image as a buffer plus its Commons/Wikipedia file page,
 * only when the file is public domain or CC0; null otherwise (no image, other
 * license, not a JPEG/PNG). Fetched at 900px wide, then cut to our two sizes.
 */
async function wikipediaPhoto(title: string): Promise<{ buf: Buffer; source: string } | null> {
  const summary = await getSummary(title);
  if (summary.kind !== "ok") return null;
  const body = summary.body as {
    type?: string;
    thumbnail?: { source?: string };
    originalimage?: { source?: string };
  };
  if (body.type !== "standard") return null;
  const orig = body.originalimage?.source ?? body.thumbnail?.source;
  const m = orig && /\/wikipedia\/(commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/.exec(orig);
  if (!m) return null;
  const host = m[1] === "commons" ? "commons.wikimedia.org" : "en.wikipedia.org";
  const fileName = decodeURIComponent(m[2]);
  const info = await getJson(
    `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=900&titles=${encodeURIComponent("File:" + fileName)}`,
  );
  if (info.kind !== "ok") return null;
  const pages = (info.body as { query?: { pages?: Record<string, { imageinfo?: ImageInfo[] }> } }).query?.pages;
  const ii = Object.values(pages ?? {})[0]?.imageinfo?.[0];
  const meta = ii?.extmetadata;
  if (!ii?.thumburl || !meta) return null;
  if (!isPublicDomainLicense({ LicenseShortName: meta.LicenseShortName?.value, UsageTerms: meta.UsageTerms?.value })) {
    return null;
  }
  const res = await fetch(ii.thumburl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = buf.length > 1024 && buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf.length > 1024 && buf.subarray(1, 4).toString() === "PNG";
  if (!jpeg && !png) return null;
  return { buf, source: `https://${host}/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}` };
}

/** Write both committed sizes from one Wikipedia image; true when it worked. */
async function fetchWikipediaMember(bioguide: string, title: string): Promise<string | null> {
  let photo: { buf: Buffer; source: string } | null;
  try {
    photo = await wikipediaPhoto(title);
    if (!photo) return null;
    for (const [key, dim] of Object.entries(SIZES) as [SizeKey, string][]) {
      const [w, h] = dim.split("x").map(Number);
      await sharp(photo.buf)
        .resize(w, h, { fit: "cover", position: "top" })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(`${OUT_DIR}/${bioguide}-${key}.jpg`);
    }
  } catch {
    return null;
  }
  return photo.source;
}

/**
 * Fetch every size for one member. A member counts as "has a photo" only if
 * every size downloads cleanly; a partial result is discarded so the committed
 * set is all-or-nothing per member.
 */
async function fetchMember(bioguide: string): Promise<boolean> {
  const written: string[] = [];
  for (const [key, dim] of Object.entries(SIZES) as [SizeKey, string][]) {
    const dest = `${OUT_DIR}/${bioguide}-${key}.jpg`;
    let res: Response;
    try {
      res = await fetch(`${IMAGES_BASE}/${dim}/${bioguide}.jpg`);
    } catch {
      break;
    }
    if (!res.ok) break;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isJpeg(buf)) break;
    await writeFile(dest, buf);
    written.push(dest);
  }

  if (written.length === Object.keys(SIZES).length) return true;
  await Promise.all(written.map((f) => rm(f, { force: true })));
  return false;
}

/** One small, downscaled photo for a former member; false when the source has none. */
async function fetchFormer(bioguide: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${IMAGES_BASE}/${SIZES.small}/${bioguide}.jpg`);
  } catch {
    return false;
  }
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isJpeg(buf)) return false;
  await sharp(buf)
    .resize(90, 110, { fit: "cover", position: "top" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`${OUT_DIR}/${bioguide}-small.jpg`);
  return true;
}

/** Drop any committed photo whose member is no longer in the roster. */
async function pruneStale(roster: Set<string>): Promise<number> {
  if (!existsSync(OUT_DIR)) return 0;
  const suffixes = Object.keys(SIZES).map((k) => `-${k}.jpg`);
  let removed = 0;
  for (const name of await readdir(OUT_DIR)) {
    const suffix = suffixes.find((s) => name.endsWith(s));
    if (!suffix) continue;
    const id = name.slice(0, -suffix.length);
    if (!roster.has(id)) {
      await rm(`${OUT_DIR}/${name}`, { force: true });
      removed += 1;
    }
  }
  return removed;
}

async function pool<T>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      let item: T | undefined;
      while ((item = queue.shift()) !== undefined) await fn(item);
    }),
  );
}

await run("photos", async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const { current: roster, former } = await rosters();
  console.log(`  roster: ${roster.length} current, ${former.length} former members`);

  const pruned = await pruneStale(new Set([...roster, ...former]));
  if (pruned) console.log(`  pruned ${pruned} stale photo file(s)`);

  const titles = await wikipediaTitles();
  const withPhoto: string[] = [];
  const missing: string[] = [];
  const wikipediaSources: Record<string, string> = {};
  let done = 0;
  await wikiPool(roster, WIKI_CONCURRENCY, async (bioguide) => {
    const title = titles.get(bioguide);
    const source = title ? await fetchWikipediaMember(bioguide, title) : null;
    if (source) {
      wikipediaSources[bioguide] = source;
      withPhoto.push(bioguide);
    } else {
      // No usable Wikipedia photo: keep the @unitedstates/images one. A stale
      // Wikipedia file from an earlier run is overwritten by it, or removed.
      (await fetchMember(bioguide) ? withPhoto : missing).push(bioguide);
    }
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${roster.length}`);
  });
  withPhoto.sort();
  missing.sort();
  const wikipedia = Object.keys(wikipediaSources).sort();

  const formerWithPhoto: string[] = [];
  let formerDone = 0;
  await pool(former, CONCURRENCY, async (bioguide) => {
    const dest = `${OUT_DIR}/${bioguide}-small.jpg`;
    if (existsSync(dest) || (await fetchFormer(bioguide))) formerWithPhoto.push(bioguide);
    formerDone += 1;
    if (formerDone % 500 === 0) console.log(`  former ${formerDone}/${former.length}`);
  });
  formerWithPhoto.sort();

  await writeFile(
    MANIFEST,
    JSON.stringify(
      {
        generated: new Date().toISOString().slice(0, 10),
        source: IMAGES_BASE,
        sizes: SIZES,
        counts: {
          roster: roster.length,
          withPhoto: withPhoto.length,
          missing: missing.length,
          wikipedia: wikipedia.length,
          former: formerWithPhoto.length,
        },
        withPhoto,
        missing,
        wikipedia,
        wikipediaSources: Object.fromEntries(wikipedia.map((id) => [id, wikipediaSources[id]])),
        former: formerWithPhoto,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`  ${wikipedia.length} of those from Wikipedia, the rest from @unitedstates/images`);
  console.log(
    `  ${withPhoto.length} with a photo, ${missing.length} missing (placeholder)`,
  );
  if (missing.length) console.log(`  missing: ${missing.join(", ")}`);
  console.log(`  ${formerWithPhoto.length} of ${former.length} former members have a photo`);
});
