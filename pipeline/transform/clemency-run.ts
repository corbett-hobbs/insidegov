import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { clemencyGrant, clemencyProclamation, offenseCategory, type ClemencyGrant, type ClemencyTermId, type OffenseCategory } from "../../lib/clemency-entities";
import { BIDEN_DISCLOSURE, CLEMENCY_RAW } from "../fetch/clemency";
import { buildYears, fiscalYear, isoDate, markAmended, parseRecipientPage, parseStatistics, parseWarrantDetails, sentenceYearOf } from "./clemency";

export const OFFENSE_CACHE = "pipeline/classification/clemency_offenses.json";
const OUT = "pipeline/output";
const raw = (f: string) => readFileSync(`${CLEMENCY_RAW}/${f}`, "utf8");
const PAGES: [string, "p" | "c" | "mixed", ClemencyTermId][] = [
  ["clemency-grants-president-donald-j-trump-2025-present", "mixed", "trump2"],
  ["pardons-granted-president-joseph-biden-2021-2025", "p", "biden"],
  ["commutations-granted-president-joseph-biden-2021-2025", "c", "biden"],
  ["pardons-granted-president-donald-j-trump-2017-2021", "p", "trump1"],
  ["commutations-granted-president-donald-j-trump-2017-2021", "c", "trump1"],
  ["pardons-granted-president-barack-h-obama-2009-2017", "p", "obama"],
  ["commutations-granted-president-barack-h-obama-2009-2017", "c", "obama"],
  ["pardons-granted-president-george-w-bush-2001-2009", "p", "bush43"],
  ["commutations-granted-president-george-w-bush-2001-2009", "c", "bush43"],
  ["pardons-granted-president-william-j-clinton-1993-2001", "p", "clinton"],
  ["commutations-granted-president-william-j-clinton-1993-2001", "c", "clinton"],
];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const BIDEN_DEC = "2024-12-12";
const BIDEN_JAN = "2025-01-17";
export const BIDEN_GROUP = [
  { date: BIDEN_DEC, people: 1499, warrant: "https://www.justice.gov/pardon/media/1380216/dl?inline", note: "One warrant; the names are in the scanned warrant and no offenses are listed." },
  { date: BIDEN_JAN, people: 2490, warrant: "https://www.justice.gov/pardon/media/1385601/dl?inline", note: "Three warrants; the names are in the scanned warrants, and DOJ lists offenses only for the people on warrant 2." },
];

export const offenseKey = (o: string) => o.toLowerCase().replace(/\s+/g, " ").trim();

export function readCache(): Map<string, OffenseCategory> {
  if (!existsSync(OFFENSE_CACHE)) return new Map();
  const rows = z.array(z.object({ offense: z.string(), category: offenseCategory, evidence: z.string() })).parse(JSON.parse(readFileSync(OFFENSE_CACHE, "utf8")));
  return new Map(rows.map((r) => [offenseKey(r.offense), r.category]));
}

/** Every listed person, without categories applied. */
export function buildGrants(): ClemencyGrant[] {
  const headings = new Map<string, string>();
  const seen = new Map<string, number>();
  const uid = (base: string) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  const rows: ClemencyGrant[] = [];
  for (const [page, type, term] of PAGES) {
    for (const r of parseRecipientPage(raw(`${page}.html`), type)) {
      if (r.date < "1993-01-20") continue;
      const id = uid(`${r.date}-${slug(r.name)}`);
      headings.set(id, r.heading);
      rows.push({ id, name: r.name, type: r.type, term, date: r.date, fy: fiscalYear(r.date), district: r.district, sentence: r.sentence, offense: r.offense, sentenceYear: sentenceYearOf(r.sentence, Number(r.date.slice(0, 4))), category: null, warrant: r.warrant ? new URL(r.warrant, "https://www.justice.gov").href : undefined });
    }
  }
  // Biden's group warrants. DOJ's scans of the names are OCR-quality, with names run together and misread, so people aren't listed from
  // them; each warrant is one row. The one clean table (warrant 2's disclosure) lists its people, inside the group's count. Register numbers are never published.
  for (const g of BIDEN_GROUP) {
    rows.push({ id: `biden-group-${g.date}`, name: `Group commutation: ${g.people.toLocaleString("en-US")} people`, type: "g", term: "biden", date: g.date, fy: fiscalYear(g.date), district: "", sentence: "", offense: g.note, sentenceYear: null, category: null, people: g.people, warrant: g.warrant });
  }
  for (const d of parseWarrantDetails(raw(`biden-warrant-${BIDEN_DISCLOSURE}.txt`))) {
    rows.push({ id: uid(`${BIDEN_JAN}-${slug(d.name)}`), name: d.name, type: "g", term: "biden", date: BIDEN_JAN, fy: fiscalYear(BIDEN_JAN), district: d.district, sentence: `${d.months === "LIFE" ? "Life" : `${d.months} months`} (${d.sentenced})`, offense: d.statutes, sentenceYear: Number(d.sentenced.slice(-4)), category: null, inGroup: true, warrant: `https://www.justice.gov/pardon/media/${BIDEN_DISCLOSURE}/dl?inline` });
  }
  return markAmended(rows, headings);
}

function main() {
  const procs = z.array(clemencyProclamation).parse(JSON.parse(readFileSync("pipeline/reference/clemency-proclamations.json", "utf8")));
  const cache = readCache();
  const grants = buildGrants().map((g) => ({ ...g, category: g.offense && g.people == null ? (cache.get(offenseKey(g.offense)) ?? null) : null }));
  const procRows: ClemencyGrant[] = procs.map((p) => ({ id: `proclamation-${p.number}`, name: `${p.title}: ${p.people ? `${p.countBasis === "reported" ? "about " : ""}${p.people.toLocaleString("en-US")} people` : "no count"}`, type: "g", term: p.term, date: p.date, fy: fiscalYear(p.date), district: "", sentence: "", offense: `${p.body} Proclamation ${p.number}.`, sentenceYear: null, category: null, people: p.people, warrant: p.url }));
  const stats = parseStatistics(raw("clemency-statistics.html"));
  const years = buildYears(stats, grants, procs, BIDEN_GROUP.map((g) => ({ fy: fiscalYear(g.date), people: g.people })));
  const end = stats.find((s) => s.term === "biden" && s.fy === 2025)?.endPending ?? null;
  const uncategorized = grants.filter((g) => g.offense && g.people == null && !g.category).length;
  const updated = isoDate(/Updated\s+([A-Za-z]+ \d{1,2}, \d{4})/.exec(raw("clemency-grants-president-donald-j-trump-2025-present.html"))?.[1] ?? "") ?? "";
  const all = z.array(clemencyGrant).parse([...procRows, ...grants].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)));
  writeFileSync(`${OUT}/clemency_years.json`, JSON.stringify({ updated, endOfBidenPending: end, proclamations: procs, years }, null, 1) + "\n");
  writeFileSync(`${OUT}/clemency_grants.json`, `[\n${all.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);
  console.log(`${all.length} rows; ${years.length} year rows; ${uncategorized} offenses uncategorized; updated ${updated}; pending at end ${end}`);
  const by: Record<string, number> = {};
  for (const g of grants) { const k = `${g.term}-${g.type}${g.amended ? "-amended" : ""}`; by[k] = (by[k] ?? 0) + 1; }
  console.log(by, "distinct offenses", new Set(grants.filter((g) => g.offense && g.people == null).map((g) => offenseKey(g.offense))).size);
  for (const y of years.filter((y) => y.term === "trump2" || y.group)) console.log(y.fy, y.term, y.pardons, y.commutations, y.group);
  const t: Record<string, [number, number]> = {};
  for (const s of stats) { const v = (t[s.term] ??= [0, 0]); v[0] += s.grantedP; v[1] += s.grantedC; }
  console.log("stats totals", t);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
