import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  TradeDataError,
  countryRow,
  dutiesByCountryRow,
  dutiesNationalRow,
  tradeByCountryRow,
  tradeNationalRow,
} from "../../lib/trade-entities";
import { CENSUS_RAW_DIR, parseRawDuties } from "../fetch/census-trade-lib";
import { DATAWEB_RAW_DIR, parseDataWebRaw } from "../fetch/dataweb-duties-lib";
import { FLOWS, PRODUCTS_RAW_DIR, parseRawDescriptions, parseRawProducts, productsDescPath, type RawProducts } from "../fetch/census-products-lib";
import { ENDUSE_RAW_DIR, parseRawEnduse, parseRawEnduseDescriptions, enduseDescPath, type RawEnduse } from "../fetch/census-enduse-lib";
import { tradeEnduseLabel, tradeEnduseNationalRow, tradeEndusePartnersRow, tradeEnduseRow } from "../../lib/trade-enduse-entities";
import { ENDUSE_PARTNERS_PER_CATEGORY, ENDUSE_TOL, buildEnduse, validateEnduse } from "./trade-enduse";
import { PRODUCTUSE_RAW_DIR, parseRawProductUse, type RawProductUse } from "../fetch/census-productuse-lib";
import { tradeProductUseRow } from "../../lib/trade-product-use-entities";
import { PRODUCT_USE_TOL, buildProductUse, validateProductUse } from "./trade-productuse";
import { tradeProductsHeading, tradeProductsNationalRow, tradeProductsPartnersRow, tradeProductsRow } from "../../lib/trade-products-entities";
import { HEADINGS_NATIONAL, HEADINGS_PER_ROW, PARTNERS_PER_PRODUCT, PRODUCTS_TOL, buildProducts, headingRows, validateProducts } from "./trade-products";
import {
  buildCountries,
  buildDuties,
  type DutiesInput,
  buildGoods,
  goodsSightings,
  parseCountryXlsx,
  parseGands,
  parseScheduleC,
  validateTrade,
} from "./trade";
import { readXlsx } from "./xlsx";

/**
 * Trade track transform: raw/census-trade/* -> pipeline/output/
 *   countries.json, trade_national.json, trade_by_country/<year>.json,
 *   duties_national.json, duties_by_country/<year>.json, trade_report.json,
 *   trade_products/<country_code>.json, trade_products_national.json, trade_products_headings.json, trade_products_partners.json,
 *   trade_enduse/<country_code>.json, trade_enduse_national.json, trade_enduse_labels.json, trade_enduse_partners.json
 *   trade_product_use/<year>.json
 * Deterministic (no run timestamp). Fails the build on any validation error.
 */
const OUT = "pipeline/output";

const oneRowPerLine = (rows: readonly unknown[]) =>
  rows.length === 0 ? "[]\n" : `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;

async function writeShards<T extends { year: number }>(dir: string, rows: T[]): Promise<Record<string, number>> {
  await rm(`${OUT}/${dir}`, { recursive: true, force: true });
  await mkdir(`${OUT}/${dir}`, { recursive: true });
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);
  const sizes: Record<string, number> = {};
  for (const y of years) {
    const path = `${OUT}/${dir}/${y}.json`;
    await writeFile(path, oneRowPerLine(rows.filter((r) => r.year === y)));
    sizes[`${dir}/${y}.json`] = (await stat(path)).size;
  }
  return sizes;
}

/** One file per partner (the page loads one country at a time). */
async function writeCountryShards<T extends { country_code: string }>(dir: string, rows: T[]): Promise<{ total: number; largest: { file: string; bytes: number } }> {
  await rm(`${OUT}/${dir}`, { recursive: true, force: true });
  await mkdir(`${OUT}/${dir}`, { recursive: true });
  const byCode = new Map<string, T[]>();
  for (const r of rows) byCode.set(r.country_code, [...(byCode.get(r.country_code) ?? []), r]);
  let total = 0;
  let largest = { file: "", bytes: 0 };
  for (const [code, list] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
    const path = `${OUT}/${dir}/${code}.json`;
    await writeFile(path, oneRowPerLine(list));
    const bytes = (await stat(path)).size;
    total += bytes;
    if (bytes > largest.bytes) largest = { file: `${dir}/${code}.json`, bytes };
  }
  return { total, largest };
}

async function readRawProducts(): Promise<RawProducts[]> {
  const out: RawProducts[] = [];
  for (const flow of FLOWS) {
    const dir = `${PRODUCTS_RAW_DIR}/${flow}`;
    const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}\.json$/.test(f)).sort();
    if (!files.length) throw new TradeDataError(`${dir} is empty — run pnpm fetch:census-products`);
    for (const f of files) {
      const raw = parseRawProducts(JSON.parse(await readFile(`${dir}/${f}`, "utf8")));
      if (`${raw.year}.json` !== f || raw.flow !== flow) throw new TradeDataError(`${dir}/${f}: flow/year fields (${raw.flow} ${raw.year}) do not match the path`);
      if (raw.heading_k < HEADINGS_PER_ROW) throw new TradeDataError(`${dir}/${f}: keeps ${raw.heading_k} headings per partner, fewer than HEADINGS_PER_ROW (${HEADINGS_PER_ROW})`);
      out.push(raw);
    }
  }
  return out;
}

async function readRawEnduse(): Promise<RawEnduse[]> {
  const out: RawEnduse[] = [];
  for (const flow of FLOWS) {
    const dir = `${ENDUSE_RAW_DIR}/${flow}`;
    const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}\.json$/.test(f)).sort();
    if (!files.length) throw new TradeDataError(`${dir} is empty — run pnpm fetch:census-enduse`);
    for (const f of files) {
      const raw = parseRawEnduse(JSON.parse(await readFile(`${dir}/${f}`, "utf8")));
      if (`${raw.year}.json` !== f || raw.flow !== flow) throw new TradeDataError(`${dir}/${f}: flow/year fields (${raw.flow} ${raw.year}) do not match the path`);
      out.push(raw);
    }
  }
  return out;
}

async function readRawProductUse(): Promise<RawProductUse[]> {
  const out: RawProductUse[] = [];
  for (const flow of FLOWS) {
    const dir = `${PRODUCTUSE_RAW_DIR}/${flow}`;
    const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => /^\d{4}\.json$/.test(f)).sort();
    if (!files.length) throw new TradeDataError(`${dir} is empty — run pnpm fetch:census-productuse`);
    for (const f of files) {
      const raw = parseRawProductUse(JSON.parse(await readFile(`${dir}/${f}`, "utf8")));
      if (`${raw.year}.json` !== f || raw.flow !== flow) throw new TradeDataError(`${dir}/${f}: flow/year fields (${raw.flow} ${raw.year}) do not match the path`);
      out.push(raw);
    }
  }
  return out;
}

async function size(name: string): Promise<number> {
  return (await stat(`${OUT}/${name}`)).size;
}

async function readRawDuties(): Promise<DutiesInput[]> {
  const dir = `${CENSUS_RAW_DIR}/duties`;
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => /^\d{4}\.json$/.test(f)).sort();
  } catch {
    throw new TradeDataError(`${dir} is missing — run pnpm fetch:census-trade`);
  }
  if (!files.length) throw new TradeDataError(`${dir} is empty — run pnpm fetch:census-trade`);
  const out: DutiesInput[] = [];
  for (const f of files) {
    const raw = parseRawDuties(JSON.parse(await readFile(`${dir}/${f}`, "utf8")));
    if (`${raw.year}.json` !== f) throw new TradeDataError(`${dir}/${f}: year field ${raw.year} does not match the file name`);
    out.push({ year: raw.year, rows: raw.rows, source: "census_api" });
  }
  // The frozen one-time USITC DataWeb bridge (earlier years). Absent => the series simply starts in 2010.
  for (const f of (await readdir(DATAWEB_RAW_DIR).catch(() => [] as string[])).filter((f) => /^\d{4}\.json$/.test(f)).sort()) {
    const raw = parseDataWebRaw(JSON.parse(await readFile(`${DATAWEB_RAW_DIR}/${f}`, "utf8")));
    if (`${raw.year}.json` !== f) throw new TradeDataError(`${DATAWEB_RAW_DIR}/${f}: year field ${raw.year} does not match the file name`);
    out.push({ year: raw.year, rows: raw.rows, source: "usitc_dataweb" });
  }
  return out;
}

async function main() {
  console.log("transform:trade");
  const readRaw = async (f: string) => {
    try {
      return await readFile(`${CENSUS_RAW_DIR}/${f}`);
    } catch {
      throw new TradeDataError(`${CENSUS_RAW_DIR}/${f} is missing — run pnpm fetch:census-trade`);
    }
  };
  const goodsData = parseCountryXlsx(readXlsx(await readRaw("country.xlsx")));
  const gands = parseGands(readXlsx(await readRaw("gands.xlsx")));
  const schedC = parseScheduleC((await readRaw("country.txt")).toString("latin1"));
  const rawDuties = await readRawDuties();

  // Duties first only to learn which codes the API names; countries.json is the union.
  const dutyNames = new Map<string, string>();
  for (const raw of rawDuties) for (const r of raw.rows) if (/^[1-9]\d{3}$/.test(r[1])) dutyNames.set(r[1], r[2]);
  const countries = buildCountries(goodsSightings(goodsData), dutyNames, schedC).map((c) => countryRow.parse(c));

  const goods = buildGoods(goodsData, gands, countries);
  const duties = buildDuties(rawDuties, countries);
  const national = goods.national.map((r) => tradeNationalRow.parse(r));
  const byCountry = goods.byCountry.map((r) => tradeByCountryRow.parse(r));
  const dutiesCountry = duties.byCountry.map((r) => dutiesByCountryRow.parse(r));
  const dutiesNational = duties.national.map((r) => dutiesNationalRow.parse(r));

  const v = validateTrade({
    countries,
    national,
    byCountry,
    lastYear: goods.lastYear,
    lastMonth: goods.lastMonth,
    dutiesCountry,
    dutiesNational,
    dutiesLastPeriod: duties.lastPeriod,
  });

  // Goods by product: built and validated against the goods and duties files above.
  const productsDesc = parseRawDescriptions(JSON.parse(await readFile(productsDescPath, "utf8")));
  const productsBuild = buildProducts(await readRawProducts(), countries, productsDesc);
  const products = {
    ...productsBuild,
    rows: productsBuild.rows.map((r) => tradeProductsRow.parse(r)),
    national: productsBuild.national.map((r) => tradeProductsNationalRow.parse(r)),
    headings: productsBuild.headings.map((r) => tradeProductsHeading.parse(r)),
    partners: productsBuild.partners.map((r) => tradeProductsPartnersRow.parse(r)),
  };
  const pv = validateProducts({ build: products, countries, byCountry, dutiesCountry, national });

  // Goods by Census end-use category: built and validated against the goods, duties and HS-chapter files above.
  const enduseBuild = buildEnduse(await readRawEnduse(), countries, parseRawEnduseDescriptions(JSON.parse(await readFile(enduseDescPath, "utf8"))));
  const enduse = {
    ...enduseBuild,
    rows: enduseBuild.rows.map((r) => tradeEnduseRow.parse(r)),
    national: enduseBuild.national.map((r) => tradeEnduseNationalRow.parse(r)),
    labels: enduseBuild.labels.map((r) => tradeEnduseLabel.parse(r)),
    partners: enduseBuild.partners.map((r) => tradeEndusePartnersRow.parse(r)),
  };
  const ev = validateEnduse({ build: enduse, countries, byCountry, dutiesCountry, national, products: products.rows });

  // Goods by product and use (all countries): built and validated against the HS-chapter and end-use national files above.
  const puBuild = buildProductUse(await readRawProductUse());
  const productUse = { ...puBuild, rows: puBuild.rows.map((r) => tradeProductUseRow.parse(r)) };
  const puv = validateProductUse({ build: puBuild, productsNational: products.national, enduseNational: enduse.national });
  // The heading lookup also covers every heading the product-use files carry: the Sankey card can name any of them.
  const lookup = new Set(products.headings.map((h) => h.hs));
  const puHeadings = puBuild.rows.flatMap((r) => r.rows.map((t) => t[0])).filter((hs) => !lookup.has(hs));
  products.headings = headingRows([...lookup, ...puHeadings], productsDesc).map((r) => tradeProductsHeading.parse(r));

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/countries.json`, oneRowPerLine(countries));
  await writeFile(`${OUT}/trade_national.json`, oneRowPerLine(national));
  await writeFile(`${OUT}/duties_national.json`, oneRowPerLine(dutiesNational));
  const shardSizes = {
    ...(await writeShards("trade_by_country", byCountry)),
    ...(await writeShards("duties_by_country", dutiesCountry)),
  };

  await writeFile(`${OUT}/trade_products_national.json`, oneRowPerLine(products.national));
  await writeFile(`${OUT}/trade_products_headings.json`, oneRowPerLine(products.headings));
  await writeFile(`${OUT}/trade_products_partners.json`, oneRowPerLine(products.partners));
  const productShards = await writeCountryShards("trade_products", products.rows);

  await writeFile(`${OUT}/trade_enduse_national.json`, oneRowPerLine(enduse.national));
  await writeFile(`${OUT}/trade_enduse_labels.json`, oneRowPerLine(enduse.labels));
  await writeFile(`${OUT}/trade_enduse_partners.json`, oneRowPerLine(enduse.partners));
  const enduseShards = await writeCountryShards("trade_enduse", enduse.rows);

  const productUseSizes = await writeShards("trade_product_use", productUse.rows);

  const shardTotal = (dir: string) => Object.entries(shardSizes).filter(([k]) => k.startsWith(`${dir}/`)).reduce((s, [, n]) => s + n, 0);
  const shardMax = (dir: string) => Math.max(...Object.entries(shardSizes).filter(([k]) => k.startsWith(`${dir}/`)).map(([, n]) => n));
  const real = countries.filter((c) => !c.is_aggregate);
  const dutyYears = [...new Set(dutiesCountry.map((r) => r.year))].sort();

  const sourceStats = (src: "census_api" | "usitc_dataweb") => {
    const nat = dutiesNational.filter((r) => r.source === src);
    return { rows: rawDuties.filter((r) => (r.source ?? "census_api") === src).reduce((s, r) => s + r.rows.length, 0), first_period: nat[0]?.period, last_period: nat[nat.length - 1]?.period, country_year_rows: dutiesCountry.filter((r) => r.source === src).length };
  };
  const report = {
    sources: {
      "country.xlsx": { rows: goodsData.length, first_period: `${Math.min(...goodsData.map((r) => r.year))}-01`, last_period: v.goodsLastPeriod, note: "output window starts 1991-01" },
      "gands.xlsx": { rows: gands.length / 3, first_period: String(Math.min(...gands.map((r) => Number(r.period)))), last_period: String(Math.max(...gands.map((r) => Number(r.period)))), note: "annual BOP, output window starts 1991" },
      "duties (census api)": sourceStats("census_api"),
      "duties (usitc dataweb bridge)": sourceStats("usitc_dataweb"),
    },
    countries: {
      rows: countries.length,
      partners: real.length,
      partners_by_kind: Object.fromEntries(["country", "former", "unallocated"].map((k) => [k, real.filter((c) => c.kind === k).length])),
      aggregates: countries.length - real.length,
      distinct_country_codes: new Set(real.map((c) => c.country_code)).size,
    },
    rows: {
      trade_national: national.length,
      trade_by_country: byCountry.length,
      duties_national: dutiesNational.length,
      duties_by_country: dutiesCountry.length,
    },
    coverage: {
      trade_by_country: { first_year: byCountry[0].year, last_year: goods.lastYear, last_month: goods.lastMonth },
      duties_by_country: { first_year: dutyYears[0], last_year: dutyYears[dutyYears.length - 1], last_period: duties.lastPeriod },
    },
    reconciliation: {
      tolerances: "see TOL in pipeline/transform/trade.ts",
      worst_country_sum_vs_world_1992_on: v.worstCountrySumGap,
      worst_country_sum_vs_world_1991: v.worstCountrySumGapPre1992,
      worst_duties_country_sum_vs_total: v.worstDutiesSumGap,
      worst_months_vs_annual_column_usd_millions: v.worstMonthsVsYear,
    },
    products: {
      coverage: { first_year: products.firstYear, last_year: products.lastYear, last_year_months: products.lastMonth },
      rows: products.rows.length,
      partners: new Set(products.rows.map((r) => r.country_code)).size,
      headings_per_row: HEADINGS_PER_ROW,
      headings_national: HEADINGS_NATIONAL,
      headings_in_lookup: products.headings.length,
      partners_per_product: PARTNERS_PER_PRODUCT,
      partner_lists: { chapters: products.partners.reduce((s, r) => s + Object.keys(r.chapters).length, 0), headings: products.partners.reduce((s, r) => s + Object.keys(r.headings).length, 0) },
      heading_coverage_of_goods_value: pv.headingCoverage,
      reconciliation: {
        tolerances: PRODUCTS_TOL,
        worst_chapters_vs_goods_file_share_partners_over_100m_usd_millions: pv.worstGoods,
        worst_chapters_vs_goods_file_abs_usd_millions: pv.worstGoodsAbs,
        canada_exports_year_in_progress_usd_millions: pv.canadaExportsInProgress,
        worst_chapter_duties_vs_duties_file: pv.worstDuties,
        worst_chapter_con_value_vs_duties_file: pv.worstConValue,
        worst_partner_sum_vs_all_countries_per_chapter: pv.worstCountrySum,
        worst_all_countries_vs_world_usd_millions: pv.worstNational,
      },
    },
    enduse: {
      coverage: { first_year: enduse.firstYear, last_year: enduse.lastYear, last_year_months: enduse.lastMonth },
      rows: enduse.rows.length,
      partners: new Set(enduse.rows.map((r) => r.country_code)).size,
      categories: { exports: enduse.labels.filter((l) => l.flow === "exports" && !l.special).length, imports: enduse.labels.filter((l) => l.flow === "imports" && !l.special).length, special: enduse.labels.filter((l) => l.special).length },
      partners_per_category: ENDUSE_PARTNERS_PER_CATEGORY,
      partner_lists: enduse.partners.reduce((s, r) => s + Object.keys(r.categories).length, 0),
      reconciliation: {
        tolerances: ENDUSE_TOL,
        worst_vs_goods_file_share_partners_over_100m_usd_millions: ev.worstGoods,
        worst_vs_goods_file_abs_usd_millions: ev.worstGoodsAbs,
        canada_exports_year_in_progress_usd_millions: ev.canadaExportsInProgress,
        worst_duties_vs_duties_file: ev.worstDuties,
        worst_con_value_vs_duties_file: ev.worstConValue,
        worst_value_vs_hs_chapter_file: ev.worstProductsValue,
        worst_con_value_vs_hs_chapter_file: ev.worstProductsCon,
        worst_duties_vs_hs_chapter_file: ev.worstProductsDuties,
        worst_partner_sum_vs_all_countries_per_category: ev.worstCountrySum,
        worst_partner_sum_vs_all_countries_per_category_abs: ev.worstCountrySumAbs,
        worst_partner_sum_vs_all_countries_total: ev.worstCountrySumTotal,
        worst_all_countries_vs_world_usd_millions: ev.worstNational,
      },
    },
    product_use: {
      coverage: { first_year: productUse.firstYear, last_year: productUse.lastYear, last_year_months: productUse.lastMonth },
      rows: { exports: productUse.rows.filter((r) => r.flow === "exports").reduce((s, r) => s + r.rows.length + r.special.length, 0), imports: productUse.rows.filter((r) => r.flow === "imports").reduce((s, r) => s + r.rows.length + r.special.length, 0) },
      assigned_lines: productUse.assigned.filter((a) => a.adjacent || a.mapped),
      reconciliation: {
        tolerances: PRODUCT_USE_TOL,
        checked: puv.checked,
        worst_total_usd: puv.worstTotal,
        worst_chapter_usd: puv.worstChapter,
        worst_heading_usd: puv.worstHeading,
        worst_end_use_usd: puv.worstUse,
        worst_end_use_share_moved: puv.worstMoved,
        end_use_gaps_over_1m_usd: { count: puv.useGaps.length, largest: [...puv.useGaps].sort((a, b) => b.gap - a.gap).slice(0, 8) },
      },
    },
    duties_codes_not_carried: duties.droppedAggregates,
    file_sizes_bytes: {
      "countries.json": await size("countries.json"),
      "trade_national.json": await size("trade_national.json"),
      "duties_national.json": await size("duties_national.json"),
      "trade_by_country/* (total)": shardTotal("trade_by_country"),
      "trade_by_country/* (largest year)": shardMax("trade_by_country"),
      "duties_by_country/* (total)": shardTotal("duties_by_country"),
      "duties_by_country/* (largest year)": shardMax("duties_by_country"),
      "trade_products/* (total)": productShards.total,
      "trade_products/* (largest partner)": productShards.largest,
      "trade_products_national.json": await size("trade_products_national.json"),
      "trade_products_headings.json": await size("trade_products_headings.json"),
      "trade_products_partners.json": await size("trade_products_partners.json"),
      "trade_enduse/* (total)": enduseShards.total,
      "trade_enduse/* (largest partner)": enduseShards.largest,
      "trade_enduse_national.json": await size("trade_enduse_national.json"),
      "trade_enduse_labels.json": await size("trade_enduse_labels.json"),
      "trade_enduse_partners.json": await size("trade_enduse_partners.json"),
      "trade_product_use/* (total)": Object.values(productUseSizes).reduce((s, n) => s + n, 0),
      "trade_product_use/* (largest year)": Math.max(...Object.values(productUseSizes)),
    },
  };
  await writeFile(`${OUT}/trade_report.json`, JSON.stringify(report, null, 2) + "\n");

  console.log(`  countries     ${real.length} partners (${report.countries.distinct_country_codes} country_codes) + ${report.countries.aggregates} aggregates`);
  console.log(`  goods         ${report.sources["country.xlsx"].first_period.slice(0, 4)}..${v.goodsLastPeriod}, output from 1991-01; ${byCountry.length} country-years`);
  console.log(`  duties        ${duties.national[0]?.period}..${duties.lastPeriod}; ${dutiesCountry.length} country-years`);
  console.log(`  worst country-sum vs World (1992+): ${JSON.stringify(v.worstCountrySumGap)}; 1991: ${JSON.stringify(v.worstCountrySumGapPre1992)}`);
  console.log(`  worst duties country-sum vs total: ${JSON.stringify(v.worstDutiesSumGap)}`);
  console.log(`  products      ${products.firstYear}..${products.lastYear} (${products.lastMonth} months); ${products.rows.length} partner-year-flows; largest file ${productShards.largest.file} ${productShards.largest.bytes} B`);
  console.log(`  enduse        ${enduse.firstYear}..${enduse.lastYear} (${enduse.lastMonth} months); ${enduse.rows.length} partner-year-flows; largest file ${enduseShards.largest.file} ${enduseShards.largest.bytes} B`);
  console.log(`  worst enduse vs goods file: ${JSON.stringify(ev.worstGoods)}; vs HS chapters: ${JSON.stringify(ev.worstProductsValue)}; partner sum vs all countries: ${JSON.stringify(ev.worstCountrySum)}`);
  console.log(`  product-use   ${productUse.firstYear}..${productUse.lastYear} (${productUse.lastMonth} months); ${Object.keys(productUseSizes).length} year files, largest ${Math.max(...Object.values(productUseSizes))} B`);
  console.log(`  worst product-use vs HS chapters: ${JSON.stringify(puv.worstChapter)}; vs end uses: ${JSON.stringify(puv.worstUse)}; moved between end uses: ${JSON.stringify(puv.worstMoved)}`);
  console.log(`  worst products vs goods file: ${JSON.stringify(pv.worstGoods)}; vs duties: ${JSON.stringify(pv.worstDuties)}`);
}

if (process.argv[1]?.endsWith("trade-run.ts")) {
  main().catch((err: unknown) => {
    console.error("\ntransform:trade FAILED");
    console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
