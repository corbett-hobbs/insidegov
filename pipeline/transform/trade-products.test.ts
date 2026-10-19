import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HS_CHAPTERS, SPECIAL_HEADINGS } from "../../lib/trade-hs-chapters";
import { TradeDataError, countryRow, dutiesByCountryRow, tradeByCountryRow, tradeNationalRow, type CountryRow } from "../../lib/trade-entities";
import { tradeProductsRow } from "../../lib/trade-products-entities";
import {
  FLOWS,
  PRODUCTS_RAW_DIR,
  parseRawDescriptions,
  parseRawProducts,
  productsDescPath,
  pruneHeadings,
  type RawDescriptions,
  type RawProducts,
} from "../fetch/census-products-lib";
import { HEADINGS_PER_ROW, buildProducts, validateProducts } from "./trade-products";

const OUT = "pipeline/output";
const readRows = (f: string) => JSON.parse(readFileSync(`${OUT}/${f}`, "utf8")) as unknown[];
const shards = (dir: string) => readdirSync(`${OUT}/${dir}`).flatMap((f) => readRows(`${dir}/${f}`));

const countries = readRows("countries.json").map((r) => countryRow.parse(r));
const desc = parseRawDescriptions(JSON.parse(readFileSync(productsDescPath, "utf8")));
const raws = FLOWS.flatMap((flow) =>
  readdirSync(`${PRODUCTS_RAW_DIR}/${flow}`)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => parseRawProducts(JSON.parse(readFileSync(`${PRODUCTS_RAW_DIR}/${flow}/${f}`, "utf8")))),
);

describe("chapter names", () => {
  it("names every HS chapter 01-99 except the reserved 77, and only 98-99 are special", () => {
    const codes = Object.keys(HS_CHAPTERS).sort();
    expect(codes).toHaveLength(98);
    expect(codes).not.toContain("77");
    expect(codes.filter((c) => HS_CHAPTERS[c].kind === "special")).toEqual(["98", "99"]);
    expect(new Set(Object.values(HS_CHAPTERS).map((c) => c.name)).size).toBe(98);
  });

  it("labels every special heading the raw data carries, for its flow", () => {
    for (const raw of raws) for (const r of raw.headings) if (/^9[89]/.test(r[1])) expect(SPECIAL_HEADINGS[r[1]]?.[raw.flow], `${raw.flow} ${r[1]}`).toBeTruthy();
  });
});

describe("pruneHeadings", () => {
  it("keeps every all-countries heading, each partner's top k goods headings, and every special heading", () => {
    const rows: RawProducts["headings"] = [
      ["-", "0101", "5"],
      ["-", "9999", "1"],
      ["5700", "8517", "100"],
      ["5700", "8507", "300"],
      ["5700", "8471", "200"],
      ["5700", "9999", "1"],
      ["1220", "2709", "50"],
    ];
    expect(pruneHeadings(rows, 2)).toEqual([
      ["-", "0101", "5"],
      ["-", "9999", "1"],
      ["1220", "2709", "50"],
      ["5700", "8471", "200"],
      ["5700", "8507", "300"],
      ["5700", "9999", "1"],
    ]);
  });
});

describe("buildProducts", () => {
  const cc = (census_code: string, country_code: string): CountryRow => ({ country_code, census_code, name: country_code, iso2: null, kind: "country", is_aggregate: false, first_year: 2010, last_year: 2026, note: null });
  const tiny: RawDescriptions = { fetched_at: "", exports: { hs2: {}, hs4: { "8517": "PHONES" } }, imports: { hs2: {}, hs4: { "8517": "PHONES", "9999": "LOW VALUE" } } };
  const raw = (over: Partial<RawProducts>): RawProducts => ({ fetched_at: "", flow: "imports", year: 2024, through_month: 12, heading_k: 25, chapters: [], headings: [], ...over });

  it("sums recoded Census codes into one country_code and ranks chapters by value", () => {
    const b = buildProducts(
      [
        raw({
          chapters: [
            ["7320", "85", "10", "9", "1"],
            ["7321", "85", "5", "5", "0"],
            ["7321", "99", "20", "20", "0"],
          ],
          headings: [
            ["7320", "8517", "10", "9", "1"],
            ["7321", "9999", "20", "20", "0"],
          ],
        }),
      ],
      [cc("7320", "SDN"), cc("7321", "SDN")],
      tiny,
    );
    expect(b.rows).toHaveLength(1);
    expect(tradeProductsRow.parse(b.rows[0])).toMatchObject({
      country_code: "SDN",
      value: 35,
      con_value: 34,
      duties: 1,
      chapters: [
        ["99", 20, 20, 0],
        ["85", 15, 14, 1],
      ],
      headings: [["8517", 10, 9, 1]],
      special: [["9999", 20, 20, 0]],
    });
  });

  it("fails on a chapter missing from the names table, an unlabelled special heading, or an unknown Census code", () => {
    expect(() => buildProducts([raw({ chapters: [["5700", "77", "1", "1", "0"]] })], [cc("5700", "CHN")], tiny)).toThrow(TradeDataError);
    expect(() => buildProducts([raw({ headings: [["5700", "9899", "1", "1", "0"]] })], [cc("5700", "CHN")], tiny)).toThrow(/no imports label/);
    expect(() => buildProducts([raw({ flow: "exports", headings: [["5700", "9999", "1"]] })], [cc("5700", "CHN")], tiny)).toThrow(/no exports label/);
    expect(() => buildProducts([raw({ chapters: [["5701", "85", "1", "1", "0"]] })], [cc("5700", "CHN")], tiny)).toThrow(/not in countries.json/);
  });

  it("fails when exports and imports cover different months of a year", () => {
    expect(() => buildProducts([raw({ through_month: 7 }), raw({ flow: "exports", through_month: 8 })], [], tiny)).toThrow(/re-run the fetch/);
  });
});

describe("the committed snapshot", () => {
  const b = buildProducts(raws, countries, desc);

  it("reconciles with the goods and duties files (the same gate as pnpm transform)", () => {
    const v = validateProducts({
      build: b,
      countries,
      byCountry: shards("trade_by_country").map((r) => tradeByCountryRow.parse(r)),
      dutiesCountry: shards("duties_by_country").map((r) => dutiesByCountryRow.parse(r)),
      national: readRows("trade_national.json").map((r) => tradeNationalRow.parse(r)),
    });
    expect(v.worstDuties?.share ?? 0).toBeLessThan(1e-6);
  });

  it("keeps at most HEADINGS_PER_ROW goods headings per row, none from chapters 98-99", () => {
    for (const r of b.rows) {
      expect(r.headings.length).toBeLessThanOrEqual(HEADINGS_PER_ROW);
      expect(r.headings.every((t) => !/^9[89]/.test(t[0]))).toBe(true);
    }
  });

  it("China 2025 imports: low-value estimates (heading 9999) are about $8.7B and sit in special, not headings", () => {
    const cn = b.rows.find((r) => r.country_code === "CHN" && r.year === 2025 && r.flow === "imports")!;
    const lowValue = cn.special.find((t) => t[0] === "9999")!;
    expect(lowValue[1] / 1e9).toBeGreaterThan(8);
    expect(lowValue[1] / 1e9).toBeLessThan(9.5);
    expect(cn.chapters.find((t) => t[0] === "99")![1]).toBe(lowValue[1]);
  });
});
