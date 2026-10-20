import { RAW_DIR } from "../fetch/lib";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { justice as justiceSchema, justiceBio } from "../../lib/court-entities";
import {
  legislator,
  wikipediaSummary,
  wikipediaPageviews,
  committeeSummary,
  rawCommittee,
  rawCommitteeMember,
  voteviewMemberRow,
  voteviewPartyRow,
} from "./schemas";
import {
  assertUnique,
  readCsvRows,
  readYamlDoc,
  readYamlList,
  step,
  validateAll,
  ValidationError,
} from "./lib";

/**
 * Schema-check the raw snapshots in pipeline/raw/ before the transform stage
 * reads them. Catches missing required fields, malformed numbers (e.g. a
 * DW-NOMINATE coordinate outside [-1, 1]), and duplicate keys where uniqueness
 * is expected. A failure exits non-zero and names the file, row, and reason.
 */

const VOTEVIEW = `${RAW_DIR}/voteview`;
const LEGISLATORS = `${RAW_DIR}/congress-legislators`;
const FA_DIR = `${RAW_DIR}/foreign-assistance`;

console.log("validate");

await step("voteview/HSall_members.csv", async () => {
  const file = `${VOTEVIEW}/HSall_members.csv`;
  const rows = validateAll(
    file,
    await readCsvRows(file),
    voteviewMemberRow,
    (row, i) => {
      const r = row as Record<string, string>;
      return `row ${i + 2} (icpsr ${r.icpsr}, congress ${r.congress}, "${r.bioname}")`;
    },
  );
  assertUnique(
    file,
    rows,
    (r) => `${r.icpsr}|${r.congress}|${r.chamber}`,
    (r) => `${r.bioname} (icpsr ${r.icpsr}, congress ${r.congress}, ${r.chamber})`,
  );
  return `${rows.length} rows ok, (icpsr, congress, chamber) unique`;
});

await step("voteview/HSall_parties.csv", async () => {
  const file = `${VOTEVIEW}/HSall_parties.csv`;
  const rows = validateAll(
    file,
    await readCsvRows(file),
    voteviewPartyRow,
    (_row, i) => `row ${i + 2}`,
  );
  assertUnique(
    file,
    rows,
    (r) => `${r.congress}|${r.chamber}|${r.party_code}`,
    (r) => `congress ${r.congress}, ${r.chamber}, party ${r.party_code} (${r.party_name})`,
  );
  return `${rows.length} rows ok, (congress, chamber, party_code) unique`;
});

const legislatorRows: { file: string; bioguide: string; name: string }[] = [];

for (const name of ["legislators-current.yaml", "legislators-historical.yaml"]) {
  await step(`congress-legislators/${name}`, async () => {
    const file = `${LEGISLATORS}/${name}`;
    const rows = validateAll(file, await readYamlList(file), legislator, (row, i) => {
      const id = (row as { id?: { bioguide?: string } }).id?.bioguide ?? "?";
      return `entry ${i} (bioguide ${id})`;
    });
    for (const r of rows) {
      legislatorRows.push({
        file,
        bioguide: r.id.bioguide,
        name: [r.name.first, r.name.last].join(" "),
      });
    }
    return `${rows.length} legislators ok`;
  });
}

await step("congress-legislators: bioguide uniqueness across both files", async () => {
  assertUnique(
    "congress-legislators/*.yaml",
    legislatorRows,
    (r) => r.bioguide,
    (r) => `${r.name} [${r.bioguide}] from ${r.file}`,
  );
  return `${legislatorRows.length} bioguide ids unique`;
});

const knownBioguides = new Set(legislatorRows.map((r) => r.bioguide));

let committeeIds = new Set<string>();
await step("congress-legislators/committees-current.yaml", async () => {
  const file = `${LEGISLATORS}/committees-current.yaml`;
  const rows = validateAll(file, await readYamlList(file), rawCommittee, (row, i) => {
    const id = (row as { thomas_id?: string }).thomas_id ?? "?";
    return `entry ${i} (thomas_id ${id})`;
  });
  assertUnique(
    file,
    rows,
    (r) => r.thomas_id,
    (r) => `${r.name} [${r.thomas_id}]`,
  );
  committeeIds = new Set(rows.map((r) => r.thomas_id));
  return `${rows.length} committees ok (${rows.filter((r) => r.type === "house").length} house, ${rows.filter((r) => r.type === "senate").length} senate, ${rows.filter((r) => r.type === "joint").length} joint)`;
});

await step("congress-legislators/committee-membership-current.yaml", async () => {
  const file = `${LEGISLATORS}/committee-membership-current.yaml`;
  const doc = await readYamlDoc(file);
  if (doc == null || typeof doc !== "object" || Array.isArray(doc)) {
    throw new ValidationError(file, "document", "expected a YAML mapping of committee id -> members");
  }
  let rosterRows = 0;
  let unknownBioguides = 0;
  for (const [key, members] of Object.entries(doc as Record<string, unknown>)) {
    if (!Array.isArray(members)) {
      throw new ValidationError(file, `key ${key}`, "expected a list of members");
    }
    // Subcommittee rosters are keyed <parent><digits>; only parent committees
    // must resolve to a committees-current.yaml entry.
    const isParentKey = /^[A-Z0-9]{4}$/.test(key);
    if (isParentKey && !committeeIds.has(key)) {
      throw new ValidationError(
        file,
        `key ${key}`,
        "roster for a committee not in committees-current.yaml",
      );
    }
    const validated = validateAll(
      file,
      members,
      rawCommitteeMember,
      (row, i) => {
        const b = (row as { bioguide?: string }).bioguide ?? "?";
        return `${key}[${i}] (bioguide ${b})`;
      },
    );
    for (const m of validated) {
      rosterRows += 1;
      if (!knownBioguides.has(m.bioguide)) unknownBioguides += 1;
    }
  }
  if (unknownBioguides > 0) {
    throw new ValidationError(
      file,
      "bioguide resolution",
      `${unknownBioguides} roster member(s) have a bioguide not present in congress-legislators`,
    );
  }
  return `${rosterRows} roster rows ok, every bioguide resolves`;
});

// Our own output, not a raw snapshot — but it is committed and written by a
// scheduled job (fetch:wikipedia), so CI re-checks it on every push.
await step("output/wikipedia_summaries.json", async () => {
  const file = "pipeline/output/wikipedia_summaries.json";
  const rows = validateAll(
    file,
    JSON.parse(await readFile(file, "utf8")) as unknown[],
    wikipediaSummary,
    (row, i) => `record ${i} (bioguide ${(row as { bioguide_id?: string }).bioguide_id ?? "?"})`,
  );
  assertUnique(file, rows, (r) => r.bioguide_id, (r) => `${r.title} [${r.bioguide_id}]`);
  const unknown = rows.filter((r) => !knownBioguides.has(r.bioguide_id));
  if (unknown.length > 0) {
    throw new ValidationError(
      file,
      "bioguide resolution",
      `${unknown.length} record(s) have a bioguide not present in congress-legislators: ${unknown.map((r) => r.bioguide_id).join(", ")}`,
    );
  }
  return `${rows.length} records ok, bioguide_id unique and resolves`;
});

// Written weekly by fetch:wikipedia-pageviews (committed), so CI re-checks it on every push.
await step("output/wikipedia_pageviews_members.json", async () => {
  const file = "pipeline/output/wikipedia_pageviews_members.json";
  const out = wikipediaPageviews.parse(JSON.parse(await readFile(file, "utf8")));
  assertUnique(file, out.rows, (r) => r.id, (r) => `${r.title} [${r.id}]`);
  const unknown = out.rows.filter((r) => !knownBioguides.has(r.id));
  if (unknown.length > 0) {
    throw new ValidationError(file, "bioguide resolution", `${unknown.length} row(s) have a bioguide not present in congress-legislators: ${unknown.map((r) => r.id).join(", ")}`);
  }
  return `${out.rows.length} members ok, window ${out.start} to ${out.end}`;
});

// Written by fetch:wikipedia-committees (committed), so CI re-checks it on every push.
await step("output/committee_summaries.json", async () => {
  const file = "pipeline/output/committee_summaries.json";
  const rows = validateAll(
    file,
    JSON.parse(await readFile(file, "utf8")) as unknown[],
    committeeSummary,
    (row, i) => `record ${i} (committee ${(row as { committee_id?: string }).committee_id ?? "?"})`,
  );
  assertUnique(file, rows, (r) => r.committee_id, (r) => `${r.title} [${r.committee_id}]`);
  const known = new Set(
    (JSON.parse(await readFile("pipeline/output/committees.json", "utf8")) as { committee_id: string }[]).map(
      (c) => c.committee_id,
    ),
  );
  const unknown = rows.filter((r) => !known.has(r.committee_id));
  if (unknown.length > 0) {
    throw new ValidationError(
      file,
      "committee resolution",
      `${unknown.length} record(s) have a committee_id not in committees.json: ${unknown.map((r) => r.committee_id).join(", ")}`,
    );
  }
  return `${rows.length} records ok, committee_id unique and resolves`;
});

// Written by fetch:justice-bios (committed, like wikipedia_summaries.json), so CI
// re-checks it on every push: every row resolves to a justice, one row each,
// and every photo it names is on disk.
await step("output/court/justice_bios.json", async () => {
  const file = "pipeline/output/court/justice_bios.json";
  const rows = validateAll(
    file,
    JSON.parse(await readFile(file, "utf8")) as unknown[],
    justiceBio,
    (row, i) => `record ${i} (justice ${(row as { justice_id?: number }).justice_id ?? "?"})`,
  );
  assertUnique(file, rows, (r) => String(r.justice_id), (r) => `${r.title} [${r.justice_id}]`);
  const known = new Set(
    (JSON.parse(await readFile("pipeline/output/court/justices.json", "utf8")) as unknown[]).map(
      (j) => justiceSchema.parse(j).justice_id,
    ),
  );
  const unknown = rows.filter((r) => !known.has(r.justice_id));
  if (unknown.length > 0) {
    throw new ValidationError(file, "justice resolution", `${unknown.length} record(s) name a justice_id not in justices.json: ${unknown.map((r) => r.justice_id).join(", ")}`);
  }
  const missing = rows.filter((r) => r.photo && !existsSync(`public${r.photo.path}`));
  if (missing.length > 0) {
    throw new ValidationError(file, "photo files", `missing on disk: ${missing.map((r) => r.photo!.path).join(", ")}`);
  }
  const review = rows.filter((r) => r.needs_review);
  if (review.length > 0) {
    throw new ValidationError(file, "needs_review", `unresolved needs_review: ${review.map((r) => r.justice_id).join(", ")}`);
  }
  return `${rows.length} records ok, ${rows.filter((r) => r.photo).length} photos on disk`;
});

// --- Supreme Court track: raw inputs (Martin-Quinn + FJC bios) ---------------
// Cheap structural checks only; the full identity / crosswalk / sanity
// validation lives in transform/court.ts and runs on every `pnpm transform`.
await step("mq/<latest>: justices.csv + court.csv structure", async () => {
  const { readdir } = await import("node:fs/promises");
  const { COURT_HEADER, JUSTICES_HEADER, latestReleaseYear } = await import("../fetch/mq-check");
  const year = latestReleaseYear(await readdir(`${RAW_DIR}/mq`));
  if (year === null) throw new ValidationError(`${RAW_DIR}/mq`, "release folder", "no <year>/ folder found");
  const dir = `${RAW_DIR}/mq/${year}`;
  const check = async (name: string, cols: string[]) => {
    const rows = await readCsvRows(`${dir}/${name}`);
    const have = new Set(Object.keys(rows[0] ?? {}));
    const missing = cols.filter((c) => !have.has(c));
    if (missing.length > 0) throw new ValidationError(`${dir}/${name}`, "header", `missing columns: ${missing.join(", ")}`);
    return rows.length;
  };
  const j = await check("justices.csv", JUSTICES_HEADER);
  const c = await check("court.csv", COURT_HEADER);
  return `release ${year}: ${j} justice-term rows, ${c} court rows`;
});

await step("fjc: federal-judicial-service.csv + demographics.csv structure", async () => {
  const need = {
    "federal-judicial-service.csv": ["nid", "Court Name", "Appointing President", "Party of Appointing President", "Commission Date", "Senior Status Date", "Termination Date"],
    "demographics.csv": ["nid", "Last Name", "First Name", "Birth Year", "Death Year"],
  };
  let n = 0;
  for (const [name, cols] of Object.entries(need)) {
    const rows = await readCsvRows(`${RAW_DIR}/fjc/${name}`);
    const have = new Set(Object.keys(rows[0] ?? {}));
    const missing = cols.filter((c) => !have.has(c));
    if (missing.length > 0) throw new ValidationError(`${RAW_DIR}/fjc/${name}`, "header", `missing columns: ${missing.join(", ")}`);
    n += rows.length;
  }
  return `${n} rows, required columns present`;
});

// --- Executive orders track --------------------------------------------------
// The raw Federal Register snapshot: schema, one row per EO number, every
// signing date inside a tenure whose president matches the Federal Register's,
// eo_number monotonic with signing_date (known publication-order exceptions
// allowlisted), every EO has a cached topic, and the count anchors.
// The full build is `transform/executive-orders-run.ts`; this is the same pure
// checks, run on the raw input before anything downstream reads it.
await step("federal-register/executive_orders.json", async () => {
  const { administration, executiveOrder } = await import("../../lib/executive-orders-entities");
  const { ADMINISTRATIONS } = await import("../transform/administrations");
  const { readRaw, readCache } = await import("../transform/executive-orders-run");
  const ex = await import("../transform/executive-orders");
  const administrations = ADMINISTRATIONS.map((a) => administration.parse(a));
  const norm = ex.normalizeRaw(await readRaw());
  const rows = ex
    .buildExecutiveOrders(norm, administrations, await readCache())
    .map((r) => executiveOrder.parse(r));
  const s = ex.validateExecutiveOrders(rows, administrations);
  return `${s.count} EOs ok (${s.firstSigning}..${s.lastSigning}), eo_number unique + monotonic (${s.explainedOutOfOrder.length} known publication-order exceptions), every topic cached, anchors ok (Biden ${s.bidenCount}, Trump 2025 ${s.trump2025Count}, 2025 total ${s.total2025})`;
});

// Our own output, committed — re-checked on every push like wikipedia_summaries.json.
await step("output/executive_orders.json + administrations.json", async () => {
  const { administration, executiveOrder } = await import("../../lib/executive-orders-entities");
  const eoFile = "pipeline/output/executive_orders.json";
  const eos = validateAll(
    eoFile,
    JSON.parse(await readFile(eoFile, "utf8")) as unknown[],
    executiveOrder,
    (row, i) => `record ${i} (EO ${(row as { eo_number?: number }).eo_number ?? "?"})`,
  );
  assertUnique(eoFile, eos, (r) => String(r.eo_number), (r) => `EO ${r.eo_number} ${r.title}`);
  const adminFile = "pipeline/output/administrations.json";
  const admins = validateAll(
    adminFile,
    JSON.parse(await readFile(adminFile, "utf8")) as unknown[],
    administration,
    (row, i) => `record ${i} (${(row as { term_id?: string }).term_id ?? "?"})`,
  );
  assertUnique(adminFile, admins, (r) => r.term_id, (r) => `${r.president} ${r.term_id}`);
  const known = new Set(admins.map((a) => a.term_id));
  const dangling = eos.filter((e) => !known.has(e.term_id));
  if (dangling.length > 0) {
    throw new ValidationError(eoFile, "term_id resolution", `${dangling.length} EO(s) name a term_id not in administrations.json`);
  }
  return `${eos.length} EOs, ${admins.length} tenures ok; every term_id resolves`;
});

// --- Economic indicators track ----------------------------------------------
// Raw FRED snapshots (schema, FRED frequency unchanged, "." skipped, values
// finite), then the same whole-output checks `transform` runs: (series_id, date)
// unique and the display-window coverage assertion. Then our committed output.
await step("fred/*.json", async () => {
  const { buildIndicators, validateIndicators } = await import("../transform/indicators");
  const { readRawFred } = await import("../transform/indicators-run");
  const built = buildIndicators(await readRawFred());
  const s = validateIndicators(built.series, built.observations);
  return `${built.series.length} series, ${built.observations.length} observations ok; coverage ok from the display window start; last observations ${JSON.stringify(s.lastObservation)}`;
});

await step("output/indicator_series.json + indicator_observations.json", async () => {
  const { indicatorObservation, indicatorSeries } = await import("../../lib/indicator-entities");
  const { validateIndicators } = await import("../transform/indicators");
  const serFile = "pipeline/output/indicator_series.json";
  const obsFile = "pipeline/output/indicator_observations.json";
  const series = validateAll(
    serFile,
    JSON.parse(await readFile(serFile, "utf8")) as unknown[],
    indicatorSeries,
    (row, i) => `record ${i} (${(row as { series_id?: string }).series_id ?? "?"})`,
  );
  const obs = validateAll(
    obsFile,
    JSON.parse(await readFile(obsFile, "utf8")) as unknown[],
    indicatorObservation,
    (row, i) => `record ${i} (${(row as { series_id?: string }).series_id ?? "?"} ${(row as { date?: string }).date ?? "?"})`,
  );
  validateIndicators(series, obs);
  return `${series.length} series, ${obs.length} observations ok; (series_id, date) unique`;
});

// --- Energy track ------------------------------------------------------------
// Raw EIA snapshots (schema, units unchanged, row count = the API's own total, known missing
// markers only), then the same whole-output checks `transform` runs, then our committed output.
await step("eia/*.json", async () => {
  const { buildEnergy, validateEnergy } = await import("../transform/energy");
  const { readRawEnergy } = await import("../transform/energy-run");
  const built = buildEnergy(await readRawEnergy());
  const s = validateEnergy(built.series, built.observations);
  return `${built.series.length} series, ${built.observations.length} observations ok; coverage ok from the display window start; last observations ${JSON.stringify(s.lastObservation)}`;
});

await step("output/energy_series.json + energy_observations.json", async () => {
  const { energyObservation, energySeries } = await import("../../lib/energy-entities");
  const { validateEnergy } = await import("../transform/energy");
  const serFile = "pipeline/output/energy_series.json";
  const obsFile = "pipeline/output/energy_observations.json";
  const series = validateAll(
    serFile,
    JSON.parse(await readFile(serFile, "utf8")) as unknown[],
    energySeries,
    (row, i) => `record ${i} (${(row as { series_id?: string }).series_id ?? "?"})`,
  );
  const obs = validateAll(
    obsFile,
    JSON.parse(await readFile(obsFile, "utf8")) as unknown[],
    energyObservation,
    (row, i) => `record ${i} (${(row as { series_id?: string }).series_id ?? "?"} ${(row as { date?: string }).date ?? "?"})`,
  );
  validateEnergy(series, obs);
  return `${series.length} series, ${obs.length} observations ok; (series_id, date) unique`;
});

// --- Foreign assistance track ------------------------------------------------
// Raw ForeignAssistance.gov snapshots (schema, file name = fiscal year, snapshot is the whole
// fetch: row counts equal the source's own totals), then our committed output.
await step("foreign-assistance/*.json", async () => {
  const { readRawAid } = await import("../transform/foreign-aid-run");
  const { TX_DISBURSEMENTS, TX_OBLIGATIONS } = await import("../fetch/foreign-assistance-lib");
  const { meta, years } = await readRawAid();
  for (const tx of [TX_OBLIGATIONS, TX_DISBURSEMENTS]) {
    const got = years.reduce((s, y) => s + y.sector_rows.filter((r) => r[4] === tx).length, 0);
    const want = meta.expected_records.sector[String(tx)];
    if (got !== want) throw new ValidationError(`${FA_DIR}`, "row count", `transaction type ${tx}: ${got} rows, source reported ${want}`);
  }
  return `${years.length} fiscal years (${years[0].fiscal_year}–${years[years.length - 1].fiscal_year}), row counts match the source's totals, data through ${meta.data_through}`;
});

await step("output/foreign_assistance.json + foreign_assistance_meta.json", async () => {
  const { aidMeta, aidRow } = await import("../../lib/foreign-aid-entities");
  const meta = aidMeta.parse(JSON.parse(await readFile("pipeline/output/foreign_assistance_meta.json", "utf8")));
  const file = "pipeline/output/foreign_assistance.json";
  const rows = validateAll(file, JSON.parse(await readFile(file, "utf8")) as unknown[], aidRow, (row, i) => `record ${i} (${(row as { recipient_name?: string }).recipient_name ?? "?"})`);
  assertUnique(file, rows, (r) => `${r.recipient_type}|${r.recipient_name}|${r.fiscal_year}|${r.sector_category}`, (r) => `${r.recipient_name} ${r.fiscal_year} ${r.sector_category}`);
  const years = new Set(meta.years.map((y) => y.fiscal_year));
  const cats = new Set(meta.sector_categories);
  for (const r of rows) {
    if (!years.has(r.fiscal_year)) throw new ValidationError(file, "fiscal_year", `${r.recipient_name} has fiscal_year ${r.fiscal_year}, not in foreign_assistance_meta.json`);
    if (!cats.has(r.sector_category)) throw new ValidationError(file, "sector_category", `${r.sector_category} is not in the source taxonomy`);
  }
  return `${rows.length} rows ok; (recipient, fiscal_year, sector_category) unique`;
});

// --- Laws track --------------------------------------------------------------
// Raw Bill Status and Congress.gov snapshots (schema per Congress, file name = Congress, law ids unique),
// the committed reference files, then our committed output. Numbering and the other gates live in the transform.
await step("govinfo-billstatus/*.json + congress-gov/*.json", async () => {
  const { rawCongressFile, RAW_SOURCES } = await import("../../lib/laws-entities");
  const { readdir } = await import("node:fs/promises");
  let files = 0;
  let laws = 0;
  for (const source of RAW_SOURCES) {
    const dir = `${RAW_DIR}/${source}`;
    if (!existsSync(dir)) continue;
    for (const name of (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n))) {
      const file = `${dir}/${name}`;
      const parsed = rawCongressFile.safeParse(JSON.parse(await readFile(file, "utf8")));
      if (!parsed.success) throw new ValidationError(file, "schema", parsed.error.message.slice(0, 500));
      if (parsed.data.source !== source || `${parsed.data.congress}.json` !== name) throw new ValidationError(file, "identity", `file says ${parsed.data.source} ${parsed.data.congress}`);
      assertUnique(file, parsed.data.laws, (l) => l.law_id, (l) => l.law_id);
      files++;
      laws += parsed.data.laws.length;
    }
  }
  return `${files} Congress files, ${laws} laws ok; law ids unique within each`;
});

await step("output/laws.json + laws_counts.json + laws_meta.json", async () => {
  const { lawCountRow, lawRow, lawsMeta } = await import("../../lib/laws-entities");
  const meta = lawsMeta.parse(JSON.parse(await readFile("pipeline/output/laws_meta.json", "utf8")));
  const file = "pipeline/output/laws.json";
  const rows = validateAll(file, JSON.parse(await readFile(file, "utf8")) as unknown[], lawRow, (row, i) => `record ${i} (${(row as { law_id?: string }).law_id ?? "?"})`);
  assertUnique(file, rows, (r) => r.law_id, (r) => r.law_id);
  const countsFile = "pipeline/output/laws_counts.json";
  const counts = validateAll(countsFile, JSON.parse(await readFile(countsFile, "utf8")) as unknown[], lawCountRow, (_row, i) => `record ${i}`);
  assertUnique(countsFile, counts, (r) => `${r.congress}|${r.area_id}`, (r) => `${r.congress} ${r.area_id}`);
  const areas = new Set(meta.areas.map((a) => a.id));
  for (const r of rows) if (!areas.has(r.area_id)) throw new ValidationError(file, "area_id", `${r.law_id} has area ${r.area_id}, not in laws_meta.json`);
  for (const r of rows) {
    if (r.crs_area_id === undefined) continue;
    if (!areas.has(r.crs_area_id)) throw new ValidationError(file, "crs_area_id", `${r.law_id} has CRS area ${r.crs_area_id}, not in laws_meta.json`);
    if (r.crs_area_id === r.area_id) throw new ValidationError(file, "crs_area_id", `${r.law_id} carries a CRS area equal to its area_id; it is only for a law moved off CRS's area`);
    if (r.area_id !== "commemorations" && r.crs_area_id !== "not-classified") throw new ValidationError(file, "crs_area_id", `${r.law_id} was moved off a CRS area that is neither Commemorations' flag nor an assigned gap`);
  }
  return `${rows.length} laws, ${counts.length} count rows ok; law ids and (congress, area) unique`;
});

await step("voteview/rollcalls_93on.json", async () => {
  const { rollcallManifest } = await import("../fetch/voteview-rollcalls-lib");
  const { z } = await import("zod");
  const manifest = rollcallManifest.parse(JSON.parse(await readFile(`${VOTEVIEW}/rollcalls_manifest.json`, "utf8")));
  const file = `${VOTEVIEW}/rollcalls_93on.json`;
  const tuple = z.tuple([z.number().int().min(93), z.enum(["H", "S"]), z.number().int().min(1), z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number().int().nullable(), z.number().int().nullable(), z.number().int().min(0), z.number().int().min(0), z.string()]);
  const rows = validateAll(file, JSON.parse(await readFile(file, "utf8")) as unknown[], tuple, (_row, i) => `record ${i}`);
  if (rows.length !== manifest.rows) throw new ValidationError(file, "row count", `${rows.length} rows, manifest says ${manifest.rows}`);
  assertUnique(file, rows, (r) => `${r[0]}|${r[1]}|${r[2]}`, (r) => `Congress ${r[0]} ${r[1]} roll ${r[2]}`);
  return `${rows.length} roll calls ok; (congress, chamber, rollnumber) unique; last House ${manifest.last_date.H}, Senate ${manifest.last_date.S}`;
});

await step("reference/early-law-votes.json + voteview/early_law_votes.json", async () => {
  const { earlyLawVotesRef, rawEarlyLawVotesFile } = await import("../../lib/early-law-votes-entities");
  const { mayhewEarlyFile } = await import("../../lib/mayhew-early");
  const { timelineEventsFile } = await import("../../lib/timeline-entities");
  const file = "pipeline/reference/early-law-votes.json";
  const ref = earlyLawVotesRef.parse(JSON.parse(await readFile(file, "utf8")));
  const raw = rawEarlyLawVotesFile.parse(JSON.parse(await readFile(`${VOTEVIEW}/early_law_votes.json`, "utf8")));
  const mayhew = new Map(mayhewEarlyFile.parse(JSON.parse(await readFile("pipeline/reference/mayhew-1947-1972.json", "utf8"))).entries.map((e) => [e.entry_id, e]));
  const timeline = timelineEventsFile.parse(JSON.parse(await readFile("pipeline/reference/timeline-events.json", "utf8"))).events;
  // Every law the pages show before 1973 has a reviewed entry: the Timeline's laws without a law_id and Mayhew's signed laws.
  const want = [...timeline.filter((e) => e.kind === "law" && !e.law_id).map((e) => `timeline:${e.id}`), ...[...mayhew.values()].filter((e) => e.kind === "law").map((e) => `mayhew:${e.entry_id}`)];
  const have = new Set(ref.laws.flatMap((e) => [e.timeline && `timeline:${e.timeline}`, e.mayhew && `mayhew:${e.mayhew}`]));
  const missing = want.filter((id) => !have.has(id));
  if (missing.length) throw new ValidationError(file, "coverage", `no entry for ${missing.slice(0, 8).join(", ")}`);
  const tlIds = new Set(timeline.map((e) => e.id));
  for (const e of ref.laws) {
    if (e.timeline && !tlIds.has(e.timeline)) throw new ValidationError(file, "timeline", `${e.timeline} is not a Timeline event`);
    const m = e.mayhew ? mayhew.get(e.mayhew) : undefined;
    if (e.mayhew && !m) throw new ValidationError(file, "mayhew", `${e.mayhew} is not a Mayhew 1947-72 entry`);
    if (m && m.congress !== e.congress) throw new ValidationError(file, "congress", `${e.mayhew} is the ${m.congress}th Congress, the entry says ${e.congress}`);
    const rolls = raw.congresses[String(e.congress)]?.rolls ?? [];
    for (const [ch, r] of [["H", e.house], ["S", e.senate], ["H", e.house_override], ["S", e.senate_override]] as const)
      if (r !== undefined && !rolls.some((x) => x[0] === ch && x[1] === r)) throw new ValidationError(file, "fetched", `${e.timeline ?? e.mayhew}: ${e.congress} ${ch} roll ${r} is not in early_law_votes.json; run pnpm fetch:voteview-early-votes`);
  }
  return `${ref.laws.length} laws ok (reviewed ${ref.last_reviewed}); every pre-1973 Timeline law and Mayhew signed law covered; every pick fetched`;
});

await step("reference/mayhew-early-wiki.json", async () => {
  const { mayhewEarlyWikiFile } = await import("../../lib/mayhew-early-wiki");
  const { mayhewEarlyFile } = await import("../../lib/mayhew-early");
  const file = "pipeline/reference/mayhew-early-wiki.json";
  const ref = mayhewEarlyWikiFile.parse(JSON.parse(await readFile(file, "utf8")));
  const mayhew = mayhewEarlyFile.parse(JSON.parse(await readFile("pipeline/reference/mayhew-1947-1972.json", "utf8"))).entries.filter((e) => e.kind === "law");
  const votes = JSON.parse(await readFile("pipeline/reference/early-law-votes.json", "utf8")).laws as { timeline?: string; mayhew?: string }[];
  // A law that is also a Timeline landmark links from timeline-events.json; every other signed law is reviewed here, one way or the other.
  const landmark = new Set(votes.filter((v) => v.timeline && v.mayhew).map((v) => v.mayhew));
  const ids = new Set(mayhew.map((e) => e.entry_id));
  const want = mayhew.filter((e) => !landmark.has(e.entry_id)).map((e) => e.entry_id);
  const have = new Set([...Object.keys(ref.linked), ...Object.keys(ref.unlinked)]);
  const missing = want.filter((id) => !have.has(id));
  if (missing.length) throw new ValidationError(file, "coverage", `no linked / unlinked entry for ${missing.slice(0, 8).join(", ")}`);
  for (const id of have) {
    if (!ids.has(id)) throw new ValidationError(file, id, "is not a Mayhew 1947-72 signed law");
    if (landmark.has(id)) throw new ValidationError(file, id, "is a Timeline landmark; its link comes from timeline-events.json");
  }
  // Every title must still be a real article, not a redirect, a section target or a disambiguation page. A network failure only skips the check.
  const titles = Object.entries(ref.linked).map(([id, e]) => [id, e.wiki] as const);
  let checked = 0;
  try {
    for (let i = 0; i < titles.length; i += 40) {
      const batch = titles.slice(i, i + 40);
      const q = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "pageprops", ppprop: "disambiguation", titles: batch.map(([, t]) => t).join("|") });
      let res: Response | null = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        res = await fetch(`https://en.wikipedia.org/w/api.php?${q}`, { headers: { "user-agent": "insidegov-validate/1.0 (https://github.com/corbetthobbs/insidegov; reference check)" } });
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
      if (!res?.ok) throw new Error(`MediaWiki API ${res?.status}`);
      const body = (await res.json()) as { query: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string; tofragment?: string }[]; pages: Record<string, { title: string; missing?: string; pageprops?: object }> } };
      const redirects = new Map((body.query.redirects ?? []).map((r) => [r.from, r]));
      const normalized = new Map((body.query.normalized ?? []).map((n) => [n.from, n.to]));
      const pages = new Map(Object.values(body.query.pages).map((p) => [p.title, p]));
      for (const [id, title] of batch) {
        const t1 = normalized.get(title) ?? title;
        const redirect = redirects.get(t1);
        const resolved = redirect?.to ?? t1;
        const page = pages.get(resolved);
        if (!page || page.missing !== undefined) throw new ValidationError(file, id, `Wikipedia has no article "${title}"`);
        if (page.pageprops) throw new ValidationError(file, id, `"${title}" is a disambiguation page`);
        if (redirect?.tofragment) throw new ValidationError(file, id, `"${title}" redirects to a section of "${resolved}"`);
        if (resolved !== title) throw new ValidationError(file, id, `"${title}" resolves to "${resolved}"; record the resolved title`);
        checked++;
      }
    }
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    console.warn(`  (could not reach Wikipedia, article titles not re-checked: ${(e as Error).message})`);
  }
  return `${Object.keys(ref.linked).length} linked, ${Object.keys(ref.unlinked).length} unlinked, ${landmark.size} more from the Timeline (reviewed ${ref.last_reviewed}); all signed laws covered; ${checked ? `${checked} titles confirmed on Wikipedia` : "titles not re-checked offline"}`;
});

await step("reference/mayhew-major-laws.json", async () => {
  const { mayhewFile } = await import("../../lib/laws-entities");
  const file = "pipeline/reference/mayhew-major-laws.json";
  const ref = mayhewFile.parse(JSON.parse(await readFile(file, "utf8")));
  assertUnique(file, ref.entries, (e) => e.entry_id, (e) => e.entry_id);
  return `${ref.entries.length} entries, Congresses ${ref.first_congress}-${ref.covered_through_congress}; ids unique`;
});
