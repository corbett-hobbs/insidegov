import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENDUSE_LABELS, ENDUSE_SPECIAL, enduseLabel, isSpecialEnduse } from "../../lib/trade-enduse-labels";
import { tradeEnduseLabel, tradeEnduseNationalRow, tradeEndusePartnersRow, tradeEnduseRow, type TradeEnduseRow } from "../../lib/trade-enduse-entities";
import { TradeDataError, countryRow } from "../../lib/trade-entities";
import {
  ENDUSE_RAW_DIR,
  FLOWS,
  enduseDescPath,
  parseRawEnduse,
  parseRawEnduseDescriptions,
  serializeRawEnduse,
  type RawEnduse,
  type RawEnduseDescriptions,
} from "../fetch/census-enduse-lib";
import { buildEnduse } from "./trade-enduse";

const OUT = "pipeline/output";
const readRows = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, "utf8")) as unknown[];
const shards = (dir: string) => readdirSync(`${OUT}/${dir}`).flatMap((f) => readRows(`${dir}/${f}`));

const countries = readRows("countries.json").map((r) => countryRow.parse(r));
const desc = parseRawEnduseDescriptions(JSON.parse(readFileSync(enduseDescPath, "utf8")));
const raws = FLOWS.flatMap((flow) =>
  readdirSync(`${ENDUSE_RAW_DIR}/${flow}`)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => parseRawEnduse(JSON.parse(readFileSync(`${ENDUSE_RAW_DIR}/${flow}/${f}`, "utf8")))),
);

// Parsed once: the shards are 14 MB and zod walks every tuple.
const outRows = shards("trade_enduse").map((r) => tradeEnduseRow.parse(r));
const outNational = readRows("trade_enduse_national.json").map((r) => tradeEnduseNationalRow.parse(r));
const outPartners = readRows("trade_enduse_partners.json").map((r) => tradeEndusePartnersRow.parse(r));

describe("category names", { timeout: 30_000 }, () => {
  it("names every category the raw data carries, for its flow, and nothing else", () => {
    for (const flow of FLOWS) {
      const inData = new Set(raws.filter((r) => r.flow === flow).flatMap((r) => r.rows.map((x) => x[1])));
      const named = new Set([...Object.keys(ENDUSE_LABELS[flow]), ...Object.keys(ENDUSE_SPECIAL[flow])]);
      expect([...inData].filter((c) => !named.has(c)), `${flow}: in the data but unnamed`).toEqual([]);
      expect([...named].filter((c) => !inData.has(c)), `${flow}: named but not in the data`).toEqual([]);
      expect(Object.keys(desc[flow]).sort(), `${flow}: descriptions.json`).toEqual([...inData].sort());
    }
  });

  it("names every category in the output files, and a code is never both ranked and special", () => {
    for (const r of [...outNational, ...outRows]) {
      for (const t of r.categories) {
        expect(enduseLabel(r.flow, t[0]), `${r.flow} ${t[0]}`).toBeTruthy();
        expect(isSpecialEnduse(r.flow, t[0]), `${r.flow} ${t[0]} ranked but special`).toBe(false);
      }
      for (const t of r.special) expect(isSpecialEnduse(r.flow, t[0]), `${r.flow} ${t[0]} special`).toBe(true);
    }
    for (const r of outPartners) {
      for (const code of Object.keys(r.categories)) expect(ENDUSE_LABELS[r.flow][code], `${r.flow} ${code}`).toBeTruthy();
    }
    const labels = readRows("trade_enduse_labels.json").map((r) => tradeEnduseLabel.parse(r));
    for (const flow of FLOWS) {
      const inLabels = labels.filter((l) => l.flow === flow);
      expect(inLabels.length).toBe(Object.keys(ENDUSE_LABELS[flow]).length + Object.keys(ENDUSE_SPECIAL[flow]).length);
      for (const l of inLabels) expect(l.label).toBe(enduseLabel(flow, l.code));
    }
  });

  it("uses plain sentence-case names, not Census's capitals", () => {
    for (const flow of FLOWS) {
      const names = [...Object.values(ENDUSE_LABELS[flow]), ...Object.values(ENDUSE_SPECIAL[flow])];
      for (const n of names) {
        expect(n.length, n).toBeLessThanOrEqual(60);
        expect(n, n).not.toBe(n.toUpperCase());
        expect(n[0], n).toBe(n[0].toUpperCase());
      }
      // Within a flow, a ranked name never repeats (two lines with one name could not be told apart).
      const ranked = Object.values(ENDUSE_LABELS[flow]);
      expect(new Set(ranked).size, `${flow}: duplicate names ${ranked.filter((n, i) => ranked.indexOf(n) !== i)}`).toBe(ranked.length);
    }
  });

  it("keeps the codes that change meaning by flow apart", () => {
    expect(ENDUSE_LABELS.exports["00000"]).toBe("Wheat");
    expect(ENDUSE_LABELS.imports["00000"]).toBe("Green coffee");
    expect(ENDUSE_LABELS.exports["50020"]).toBe("Military aircraft engines");
    expect(ENDUSE_SPECIAL.imports["50020"]).toBe("U.S. goods returned & reimports");
    expect(ENDUSE_LABELS.exports["41050"]).toBe("Cell phones & household goods");
  });
});

describe("raw files", () => {
  it("round-trips through the serializer", () => {
    const raw: RawEnduse = { fetched_at: "t", flow: "imports", year: 2024, through_month: 12, rows: [["-", "21320", 5, 4, 3], ["1220", "21320", 2, 2, 1]] };
    expect(parseRawEnduse(JSON.parse(serializeRawEnduse(raw)))).toEqual(raw);
    expect(parseRawEnduse(JSON.parse(serializeRawEnduse({ ...raw, rows: [] }))).rows).toEqual([]);
  });

  it("rejects a row of the wrong width for its flow", () => {
    expect(() => parseRawEnduse({ fetched_at: "t", flow: "exports", year: 2024, through_month: 12, rows: [["-", "21320", 5, 4, 3]] })).toThrow();
  });
});

describe("buildEnduse", () => {
  const d: RawEnduseDescriptions = {
    fetched_at: "t",
    exports: { "21320": "SEMICONDUCTORS", "22090": "CIVILIAN AIRCRAFT, ENGINES, EQUIPMENT, AND PARTS", "60000": "MINIMUM VALUE SHIPMENTS" },
    imports: { "21320": "SEMICONDUCTORS", "50020": "U.S. GOODS RETURNED, AND REIMPORTS" },
  };
  const exp = (year: number, rows: RawEnduse["rows"], through_month = 12): RawEnduse => ({ fetched_at: "t", flow: "exports", year, through_month, rows });
  const imp = (year: number, rows: RawEnduse["rows"], through_month = 12): RawEnduse => ({ fetched_at: "t", flow: "imports", year, through_month, rows });
  // Census 1220 = Canada, 5700 = China, 5800 = South Korea; all real partners in countries.json.
  const raws2 = [
    exp(2024, [
      ["-", "21320", 600],
      ["-", "22090", 300],
      ["-", "60000", 50],
      ["1220", "21320", 100],
      ["5700", "21320", 200],
      ["5800", "21320", 300],
      ["5700", "22090", 300],
      ["1220", "60000", 50],
    ]),
    imp(2024, [
      ["-", "21320", 90, 80, 8],
      ["-", "50020", 10, 10, 0],
      ["5800", "21320", 90, 80, 8],
      ["5800", "50020", 10, 10, 0],
    ]),
  ];

  it("splits special entries from ranked categories, keeps them in the total, and ranks partners", () => {
    const b = buildEnduse(raws2, countries, d);
    const nat = b.national.find((r) => r.year === 2024 && r.flow === "exports")!;
    expect(nat.value).toBe(950);
    expect(nat.categories).toEqual([["22090", 300], ["21320", 600]].sort((a, c) => (c[1] as number) - (a[1] as number)));
    expect(nat.special).toEqual([["60000", 50]]);
    const can = b.rows.find((r) => r.country_code === "CAN" && r.flow === "exports")!;
    expect(can.value).toBe(150);
    expect(can.categories).toEqual([["21320", 100]]);
    expect(can.special).toEqual([["60000", 50]]);
    const p = b.partners.find((r) => r.year === 2024 && r.flow === "exports")!;
    expect(Object.keys(p.categories).sort()).toEqual(["21320", "22090"]);
    expect(p.categories["21320"].map((t) => t[1])).toEqual([300, 200, 100]);
    expect(p.categories["22090"]).toHaveLength(1);
    const ip = b.partners.find((r) => r.flow === "imports")!;
    expect(ip.categories["21320"]).toEqual([["KOR", 90, 80, 8]]);
    expect(b.labels.map((l) => `${l.flow}|${l.code}|${l.special}`)).toContain("imports|50020|true");
    for (const r of b.rows) tradeEnduseRow.parse(r);
  });

  it("merges Census codes that share a country_code and keeps the top five only", () => {
    const six = ["1220", "5700", "5800", "5830", "2010", "2050"];
    const b = buildEnduse([exp(2024, [["-", "21320", 21], ...six.map((c, i) => ["" + c, "21320", i + 1] as RawEnduse["rows"][number])])], countries, d);
    const list = b.partners[0].categories["21320"];
    expect(list.map((t) => t[1])).toEqual([6, 5, 4, 3, 2]);
  });

  it("fails on a category with no label, a duplicate row, an aggregate, and an unknown country", () => {
    expect(() => buildEnduse([exp(2024, [["-", "99999", 1]])], countries, d)).toThrow(/no label/);
    expect(() => buildEnduse([exp(2024, [["1220", "21320", 1], ["1220", "21320", 1]])], countries, d)).toThrow(TradeDataError);
    expect(() => buildEnduse([exp(2024, [["0003", "21320", 1]])], countries, d)).toThrow(TradeDataError);
    expect(() => buildEnduse([exp(2024, [["9999", "21320", 1]])], countries, d)).toThrow(/not in countries.json/);
    expect(() => buildEnduse([exp(2024, [["-", "21320", 1]]), imp(2024, [["-", "21320", 1, 1, 0]], 8)], countries, d)).toThrow(/months/);
  });
});

describe("output files", { timeout: 30_000 }, () => {
  const rows = outRows;
  const national = outNational;
  const partners = outPartners;

  it("every row's value is the sum of its categories and special entries, largest first", () => {
    for (const r of [...rows, ...national]) {
      const all = [...r.categories, ...r.special];
      expect(all.reduce((s, t) => s + t[1], 0)).toBe(r.value);
      if (r.flow === "imports") {
        expect(all.reduce((s, t) => s + (t as [string, number, number, number])[2], 0)).toBe(r.con_value);
        expect(all.reduce((s, t) => s + (t as [string, number, number, number])[3], 0)).toBe(r.duties);
      }
      for (const list of [r.categories, r.special]) for (let i = 1; i < list.length; i++) expect(list[i][1]).toBeLessThanOrEqual(list[i - 1][1]);
    }
  });

  it("the partner rows add up to the all-countries row for every category, to the dollar", () => {
    const sums = new Map<string, number>();
    for (const r of rows) for (const t of [...r.categories, ...r.special]) sums.set(`${r.year}|${r.flow}|${t[0]}`, (sums.get(`${r.year}|${r.flow}|${t[0]}`) ?? 0) + t[1]);
    for (const r of national) for (const t of [...r.categories, ...r.special]) expect(sums.get(`${r.year}|${r.flow}|${t[0]}`), `${r.year} ${r.flow} ${t[0]}`).toBe(t[1]);
  });

  it("the top five partners of each category are exactly the five largest partner rows", () => {
    const by = new Map<string, TradeEnduseRow[]>();
    for (const r of rows) by.set(`${r.year}|${r.flow}`, [...(by.get(`${r.year}|${r.flow}`) ?? []), r]);
    expect(partners).toHaveLength(national.length);
    for (const p of partners) {
      const accs = by.get(`${p.year}|${p.flow}`)!;
      for (const [code, list] of Object.entries(p.categories)) {
        const want = accs
          .flatMap((r) => r.categories.filter((t) => t[0] === code).map((t) => [r.country_code, ...t.slice(1)] as [string, ...number[]]))
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 5);
        expect(list, `${p.year} ${p.flow} ${code}`).toEqual(want);
      }
    }
  });

  it("covers 2010 on, both flows, every year", () => {
    const years = [...new Set(national.map((r) => r.year))].sort();
    expect(years[0]).toBe(2010);
    for (let i = 1; i < years.length; i++) expect(years[i]).toBe(years[i - 1] + 1);
    for (const y of years) for (const f of FLOWS) expect(national.filter((r) => r.year === y && r.flow === f)).toHaveLength(1);
  });
});
