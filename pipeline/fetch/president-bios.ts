import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { presidentBio, type PresidentBio } from "../../lib/president-entities";
import { wikipediaApiSummary } from "../validate/schemas";
import { trimExtract } from "../wikipedia/trim";
import { isPublicDomainLicense } from "./justice-bios";
import { run } from "./lib";

/**
 * A short Wikipedia bio and the official portrait for each president with a page on the site (Roosevelt on), written to
 * `pipeline/output/president_bios.json` keyed by `president_slug` (the key `administrations.json` and
 * `lib/troops-presidents.ts` already use). Build-time only. Unlike the justices, the article titles are a fixed,
 * reviewed list (fifteen people, every one unambiguous), so nothing is searched for.
 *
 * Portrait: the article's lead image, kept only when its Commons/Wikipedia file-page license metadata says public
 * domain or CC0 (official White House and Library of Congress portraits are works of the U.S. government); anything
 * else leaves `photo` null and the page draws initials. Saved at 330px wide to `public/images/presidents/<slug>.jpg`.
 */
const OUT = "pipeline/output/president_bios.json";
const PHOTO_DIR = "public/images/presidents";
const USER_AGENT = "congress-ideology/0.1 (https://github.com/corbett-hobbs/congress-ideology)";
const API = "https://en.wikipedia.org/api/rest_v1/page/summary";

/** `president_slug` -> English Wikipedia article title. Order does not matter. */
export const PRESIDENT_ARTICLES: Readonly<Record<string, string>> = {
  "franklin-d-roosevelt": "Franklin D. Roosevelt",
  "harry-s-truman": "Harry S. Truman",
  "dwight-d-eisenhower": "Dwight D. Eisenhower",
  "john-f-kennedy": "John F. Kennedy",
  "lyndon-b-johnson": "Lyndon B. Johnson",
  "richard-nixon": "Richard Nixon",
  "gerald-ford": "Gerald Ford",
  "jimmy-carter": "Jimmy Carter",
  "ronald-reagan": "Ronald Reagan",
  "george-h-w-bush": "George H. W. Bush",
  "william-j-clinton": "Bill Clinton",
  "george-w-bush": "George W. Bush",
  "barack-obama": "Barack Obama",
  "donald-trump": "Donald Trump",
  "joe-biden": "Joe Biden",
};

const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`GET ${url} -> ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`GET ${url} -> gave up`);
}

const apiImage = z.looseObject({
  thumbnail: z.looseObject({ source: z.string() }).optional(),
  originalimage: z.looseObject({ source: z.string() }).optional(),
});

type ImageInfo = { thumburl?: string; extmetadata?: Record<string, { value: string }> };

async function findPhoto(slug: string, orig: string | undefined): Promise<{ photo: PresidentBio["photo"]; note: string }> {
  if (!orig) return { photo: null, note: "no image on article" };
  const m = /\/wikipedia\/(commons|en)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/.exec(orig);
  if (!m) return { photo: null, note: "could not parse image file name" };
  const host = m[1] === "commons" ? "commons.wikimedia.org" : "en.wikipedia.org";
  const fileName = decodeURIComponent(m[2]);
  const body = (await getJson(
    `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=330&titles=${encodeURIComponent("File:" + fileName)}`,
  )) as { query?: { pages?: Record<string, { imageinfo?: ImageInfo[] }> } };
  const ii = Object.values(body.query?.pages ?? {})[0]?.imageinfo?.[0];
  const meta = ii?.extmetadata;
  if (!ii?.thumburl || !meta) return { photo: null, note: `no license metadata for ${fileName}` };
  const license = meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? "";
  if (!isPublicDomainLicense({ LicenseShortName: meta.LicenseShortName?.value, UsageTerms: meta.UsageTerms?.value })) {
    return { photo: null, note: `license "${license}" is not public domain/CC0` };
  }
  const res = await fetch(ii.thumburl, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return { photo: null, note: `image download ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = buf.length > 1024 && buf[0] === 0xff && buf[1] === 0xd8;
  const png = buf.length > 1024 && buf.subarray(1, 4).toString() === "PNG";
  if (!jpeg && !png) return { photo: null, note: "image is not a JPEG/PNG" };
  const ext = jpeg ? "jpg" : "png";
  await mkdir(PHOTO_DIR, { recursive: true });
  await writeFile(`${PHOTO_DIR}/${slug}.${ext}`, buf);
  return {
    photo: {
      path: `/images/presidents/${slug}.${ext}`,
      source_url: `https://${host}/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`,
      license,
    },
    note: `photo ok (${license})`,
  };
}

if (process.argv[1]?.endsWith("president-bios.ts")) {
  await run("president-bios", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const records: PresidentBio[] = [];
    for (const [slug, title] of Object.entries(PRESIDENT_ARTICLES)) {
      const body = await getJson(`${API}/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      const api = wikipediaApiSummary.parse(body);
      if (api.type !== "standard" || !/president of the united states/i.test(api.extract)) {
        throw new Error(`${title}: not the expected article (type ${api.type})`);
      }
      const img = apiImage.parse(body);
      const { photo, note } = await findPhoto(slug, img.originalimage?.source ?? img.thumbnail?.source);
      console.log(`  ${slug}: ${note}`);
      records.push(
        presidentBio.parse({
          slug,
          title: api.title,
          extract: trimExtract(api.extract, { maxSentences: 2, maxChars: 360 }),
          url: api.content_urls.desktop.page,
          revision: api.revision,
          fetched_at: today,
          photo,
        }),
      );
    }
    records.sort((a, b) => a.slug.localeCompare(b.slug));
    await writeFile(OUT, JSON.stringify(records, null, 2) + "\n");
    console.log(`  ${records.length} bios, ${records.filter((r) => r.photo).length} photos`);
  });
}
