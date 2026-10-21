import { HS_CHAPTERS, SPECIAL_HEADINGS } from "../../lib/trade-hs-chapters";
import {
  PRODUCTS_START_YEAR,
  type TradeProductsHeading,
  type TradeProductsNationalRow,
  type TradeProductsPartnersRow,
  type TradeProductsRow,
} from "../../lib/trade-products-entities";
import { TradeDataError, type CountryRow, type DutiesByCountryRow, type TradeByCountryRow, type TradeNationalRow } from "../../lib/trade-entities";
import { isSpecialHs, type Flow, type RawDescriptions, type RawProducts } from "../fetch/census-products-lib";

/**
 * Goods by product (pure; file I/O is in trade-run.ts). Source:
 * `pipeline/raw/census-trade/products/<flow>/<year>.json` (Census API, HS2 for
 * every partner, each partner's top HS4 headings). See docs/TRADE_METHODOLOGY.md.
 */

/**
 * Goods headings per (partner, year, flow) in the output. Measured with all 17 years
 * (see docs/TRADE_METHODOLOGY.md): ten keeps the largest partner file under ~60 KB
 * (~10 KB gzipped) and covers, for the median partner-year, most of the goods value
 * the chapters show. Must not exceed the raw files' `heading_k`.
 */
export const HEADINGS_PER_ROW = 10;
/** The all-countries rows keep more headings: one small file, and the default view of the page. */
export const HEADINGS_NATIONAL = 25;
/** Countries listed behind each chapter and each all-countries heading. */
export const PARTNERS_PER_PRODUCT = 5;

/** Reconciliation tolerances. Tripping one fails the build; measured values in docs/TRADE_METHODOLOGY.md. */
export const PRODUCTS_TOL = {
  /**
   * A partner-year's chapters vs its goods-file total (`trade_by_country`, $M to one decimal
   * per month): the larger of an absolute gap in dollars and a share of the total.
   */
  goodsAbs: 1_000_000,
  goodsShare: 0.001,
  /**
   * The one measured exception: exports to Canada in the year in progress. The goods file carries
   * revisions to the year's earlier months (U.S. exports to Canada are compiled from Canadian import
   * records, with late receipts added) that the HS-level API does not have yet; the latest month and
   * every full year agree. Measured 2026 (Jan-Aug): 0.76% ($1.8B). Full years: exact.
   */
  canadaExportsInProgressShare: 0.015,
  /** Chapters' duties and imports for consumption vs `duties_by_country` (the same API): share of the total, plus $1 per chapter of rounding. */
  dutiesShare: 0.0005,
  /** Partners' chapter rows vs the API's all-countries row, per chapter-year: share of the all-countries value. */
  countrySumShare: 0.002,
  /** All-countries chapters vs the World goods total (Census basis, annual, $M). */
  nationalShare: 0.001,
};

type Values = [number, number, number] | [number];

interface Acc {
  months: number;
  chapters: Map<string, number[]>;
  headings: Map<string, number[]>;
}

const add = (m: Map<string, number[]>, code: string, v: number[]) => {
  const have = m.get(code);
  m.set(code, have ? have.map((x, i) => x + v[i]) : [...v]);
};

const byValue = (a: [string, ...number[]], b: [string, ...number[]]) => b[1] - a[1] || a[0].localeCompare(b[0]);

export interface ProductsBuild {
  rows: TradeProductsRow[];
  national: TradeProductsNationalRow[];
  headings: TradeProductsHeading[];
  partners: TradeProductsPartnersRow[];
  firstYear: number;
  lastYear: number;
  lastMonth: number;
}

function toRow(flow: Flow, year: number, acc: Acc, n: number) {
  const list = (m: Map<string, number[]>) => [...m].map(([c, v]) => [c, ...v] as [string, ...number[]]).filter((t) => t.slice(1).some((x) => x !== 0)).sort(byValue);
  const chapters = list(acc.chapters);
  const allHeadings = list(acc.headings);
  const headings = allHeadings.filter((t) => !isSpecialHs(t[0])).slice(0, n);
  const special = allHeadings.filter((t) => isSpecialHs(t[0]));
  const sum = (i: number) => chapters.reduce((s, t) => s + (t[i] as number), 0);
  if (flow === "exports") {
    return { year, months: acc.months, flow, value: sum(1), chapters, headings, special } as Extract<TradeProductsNationalRow, { flow: "exports" }>;
  }
  return { year, months: acc.months, flow, value: sum(1), con_value: sum(2), duties: sum(3), chapters, headings, special } as Extract<TradeProductsNationalRow, { flow: "imports" }>;
}

/**
 * The top countries behind every chapter and every all-countries top heading, per (year, flow). Chapters come from the
 * partners' own chapter rows (`perCountry`, keyed `${country_code}|${year}|${flow}`: every partner carries every
 * chapter, so the ranking is exact). Headings come from the raw files' `partners` rows (each top heading's top
 * partners, taken from the API's response for every partner), because a partner's own file keeps only its top 25
 * headings and so cannot rank a heading it does not list. Where a partner lists the heading too, the two sources must
 * agree to the dollar.
 */
function buildPartners(
  perCountry: Map<string, Acc>,
  national: TradeProductsNationalRow[],
  partnerRows: Map<string, [string, string, ...number[]][]>,
  codesOf: Map<string, number>,
  n: number,
): TradeProductsPartnersRow[] {
  const byYearFlow = new Map<string, [string, Acc][]>();
  for (const [key, acc] of perCountry) {
    const [cc, y, flow] = key.split("|");
    byYearFlow.set(`${y}|${flow}`, [...(byYearFlow.get(`${y}|${flow}`) ?? []), [cc, acc]]);
  }
  const rows: TradeProductsPartnersRow[] = [];
  for (const r of national) {
    const yf = `${r.year}|${r.flow}`;
    const accs = byYearFlow.get(yf) ?? [];
    const chapters: Record<string, [string, ...number[]][]> = {};
    for (const t of r.chapters) {
      if (isSpecialHs(t[0])) continue;
      chapters[t[0]] = accs
        .flatMap(([cc, acc]) => {
          const v = acc.chapters.get(t[0]);
          return v && v[0] > 0 ? [[cc, ...v] as [string, ...number[]]] : [];
        })
        .sort(byValue)
        .slice(0, n);
    }
    const raw = partnerRows.get(yf);
    if (!raw) throw new TradeDataError(`products ${yf}: the raw file has no partner rankings — run pnpm fetch:census-products --partners-only`);
    const own = new Map(accs);
    const sums = new Map<string, Map<string, number[]>>(); // heading -> country_code -> values
    for (const [cc, hs, ...v] of raw) {
      const m = sums.get(hs) ?? new Map<string, number[]>();
      sums.set(hs, m);
      add(m, cc, v);
    }
    const headings: Record<string, [string, ...number[]][]> = {};
    for (const t of r.headings) {
      const m = sums.get(t[0]);
      if (!m) throw new TradeDataError(`products ${yf}: top heading ${t[0]} has no partner rows in the raw file — run pnpm fetch:census-products --partners-only`);
      const ranked = [...m].map(([cc, v]) => [cc, ...v] as [string, ...number[]]).sort(byValue);
      for (const [cc, ...v] of ranked) {
        const have = own.get(cc)?.headings.get(t[0]);
        if (have && codesOf.get(cc) === 1 && have[0] !== v[0]) throw new TradeDataError(`products ${yf} ${t[0]} ${cc}: the partner ranking says $${v[0]} but the partner's own file says $${have[0]}`);
      }
      headings[t[0]] = ranked.slice(0, n);
    }
    rows.push({ year: r.year, months: r.months, flow: r.flow, chapters, headings } as TradeProductsPartnersRow);
  }
  return rows;
}

/** The heading lookup rows (`trade_products_headings.json`) for a set of headings, sorted: Census's description and, for a special heading, its labels. */
export function headingRows(hsList: Iterable<string>, desc: RawDescriptions): TradeProductsHeading[] {
  return [...new Set(hsList)].sort().map((hs) => {
    const census_desc = desc.imports.hs4[hs] ?? desc.exports.hs4[hs];
    if (!census_desc) throw new TradeDataError(`products: heading ${hs} has no Census description in descriptions.json`);
    const s = SPECIAL_HEADINGS[hs];
    return { hs, chapter: hs.slice(0, 2), census_desc, special_label: s ? { exports: s.exports ?? null, imports: s.imports ?? null } : null };
  });
}

export function buildProducts(raws: RawProducts[], countries: CountryRow[], desc: RawDescriptions, headingsPerRow = HEADINGS_PER_ROW): ProductsBuild {
  const toCountry = new Map(countries.map((c) => [c.census_code, c]));
  const perCountry = new Map<string, Acc>(); // `${country_code}|${year}|${flow}`
  const national = new Map<string, Acc>(); // `${year}|${flow}`
  const seen = new Set<string>();
  const monthsOfYear = new Map<number, number>();
  const usedHeadings = new Set<string>();
  const partnerRows = new Map<string, [string, string, ...number[]][]>(); // `${year}|${flow}` -> [country_code, hs4, ...values]
  let lastYear = 0;
  let firstYear = Infinity;

  for (const raw of raws) {
    if (raw.year < PRODUCTS_START_YEAR) throw new TradeDataError(`products ${raw.flow} ${raw.year}: before ${PRODUCTS_START_YEAR}`);
    if (seen.has(`${raw.flow}|${raw.year}`)) throw new TradeDataError(`products: two raw files for ${raw.flow} ${raw.year}`);
    seen.add(`${raw.flow}|${raw.year}`);
    const m = monthsOfYear.get(raw.year);
    if (m !== undefined && m !== raw.through_month) throw new TradeDataError(`products ${raw.year}: exports cover ${m} months but imports ${raw.through_month}; re-run the fetch`);
    monthsOfYear.set(raw.year, raw.through_month);
    lastYear = Math.max(lastYear, raw.year);
    firstYear = Math.min(firstYear, raw.year);

    const rowSeen = new Set<string>();
    for (const [level, rows] of [["chapter", raw.chapters], ["heading", raw.headings]] as const) {
      for (const [cty, code, ...vs] of rows) {
        const k = `${level}|${cty}|${code}`;
        if (rowSeen.has(k)) throw new TradeDataError(`products ${raw.flow} ${raw.year}: duplicate ${level} row ${cty} ${code}`);
        rowSeen.add(k);
        const ch = code.slice(0, 2);
        if (!HS_CHAPTERS[ch]) throw new TradeDataError(`products ${raw.flow} ${raw.year}: chapter ${ch} is not in lib/trade-hs-chapters.ts — name it deliberately`);
        if (level === "heading" && isSpecialHs(code) && !SPECIAL_HEADINGS[code]?.[raw.flow]) {
          throw new TradeDataError(`products ${raw.flow} ${raw.year}: special heading ${code} (${desc[raw.flow].hs4[code] ?? "?"}) has no ${raw.flow} label in SPECIAL_HEADINGS (lib/trade-hs-chapters.ts)`);
        }
        const v = vs.map(Number) as Values;
        if (v.some((x) => !Number.isSafeInteger(x) || x < 0)) throw new TradeDataError(`products ${raw.flow} ${raw.year} ${cty} ${code}: bad value ${vs.join(",")}`);
        let acc: Acc;
        if (cty === "-") {
          const key = `${raw.year}|${raw.flow}`;
          acc = national.get(key) ?? { months: raw.through_month, chapters: new Map(), headings: new Map() };
          national.set(key, acc);
        } else {
          const c = toCountry.get(cty);
          if (!c) throw new TradeDataError(`products: Census code ${cty} is not in countries.json`);
          if (c.is_aggregate) throw new TradeDataError(`products: aggregate code ${cty} in the raw rows`);
          const key = `${c.country_code}|${raw.year}|${raw.flow}`;
          acc = perCountry.get(key) ?? { months: raw.through_month, chapters: new Map(), headings: new Map() };
          perCountry.set(key, acc);
        }
        add(level === "chapter" ? acc.chapters : acc.headings, code, v);
      }
    }
    if (raw.partners) {
      const list: [string, string, ...number[]][] = [];
      for (const [cty, code, ...vs] of raw.partners) {
        const c = toCountry.get(cty);
        if (!c || c.is_aggregate) throw new TradeDataError(`products ${raw.flow} ${raw.year}: partner ranking has Census code ${cty}, not a partner in countries.json`);
        list.push([c.country_code, code, ...(vs.map(Number) as Values)]);
      }
      partnerRows.set(`${raw.year}|${raw.flow}`, list);
    }
  }

  const rows: TradeProductsRow[] = [];
  for (const [key, acc] of perCountry) {
    const [country_code, y, flow] = key.split("|");
    const r = toRow(flow as Flow, Number(y), acc, headingsPerRow);
    if (!r.chapters.length) continue;
    rows.push({ country_code, ...r });
    for (const t of [...r.headings, ...r.special]) usedHeadings.add(t[0]);
  }
  rows.sort((a, b) => a.country_code.localeCompare(b.country_code) || a.year - b.year || a.flow.localeCompare(b.flow));
  const nat: TradeProductsNationalRow[] = [...national].map(([key, acc]) => {
    const [y, flow] = key.split("|");
    return toRow(flow as Flow, Number(y), acc, HEADINGS_NATIONAL);
  });
  nat.sort((a, b) => a.year - b.year || a.flow.localeCompare(b.flow));
  for (const r of nat) for (const t of [...r.headings, ...r.special]) usedHeadings.add(t[0]);

  const headings = headingRows(usedHeadings, desc);
  const codesOf = new Map<string, number>();
  for (const c of countries) if (!c.is_aggregate) codesOf.set(c.country_code, (codesOf.get(c.country_code) ?? 0) + 1);
  const partners = buildPartners(perCountry, nat, partnerRows, codesOf, PARTNERS_PER_PRODUCT);
  return { rows, national: nat, headings, partners, firstYear, lastYear, lastMonth: monthsOfYear.get(lastYear) ?? 0 };
}

// -------------------------------------------------------------- validation

export interface Gap {
  key: string;
  got: number;
  want: number;
  gap: number;
  share: number;
}

export interface ProductsValidation {
  /** Largest share gap among partner-years of $100M or more (Canada's year in progress apart). */
  worstGoods: Gap | null;
  /** The Canada exports year-in-progress gap, reported on its own (it has its own tolerance). */
  canadaExportsInProgress: Gap | null;
  worstGoodsAbs: Gap | null;
  worstDuties: Gap | null;
  worstConValue: Gap | null;
  worstCountrySum: Gap | null;
  worstNational: Gap | null;
  /** Share of a partner-year's goods value (chapters 01-97) its kept headings cover: median and 10th percentile. */
  headingCoverage: { median: number; p10: number };
}

const worse = (a: Gap | null, b: Gap) => (!a || b.share > a.share ? b : a);
const worseAbs = (a: Gap | null, b: Gap) => (!a || b.gap > a.gap ? b : a);
const gapOf = (key: string, got: number, want: number): Gap => ({ key, got, want, gap: Math.abs(got - want), share: want ? Math.abs(got - want) / want : got ? 1 : 0 });

export function validateProducts(args: {
  build: ProductsBuild;
  countries: CountryRow[];
  byCountry: TradeByCountryRow[];
  dutiesCountry: DutiesByCountryRow[];
  national: TradeNationalRow[];
  /** False only for a trial over a few years (the fetch's `--since`); the build always requires 2010 on. */
  requireFullHistory?: boolean;
}): ProductsValidation {
  const { build, countries } = args;
  const fail = (m: string): never => {
    throw new TradeDataError(`products validation: ${m}`);
  };
  const known = new Map(countries.map((c) => [c.country_code, c]));
  const MILLION = 1e6;

  // Keys, schema-level invariants, coverage.
  const keys = new Set<string>();
  for (const r of build.rows) {
    const c = known.get(r.country_code);
    if (!c || c.is_aggregate) fail(`row ${r.country_code} is not a non-aggregate countries.json code`);
    const k = `${r.country_code}|${r.year}|${r.flow}`;
    if (keys.has(k)) fail(`duplicate row ${k}`);
    keys.add(k);
  }
  for (const r of [...build.rows, ...build.national]) {
    const who = "country_code" in r ? r.country_code : "all countries";
    const chapterValue = new Map(r.chapters.map((t) => [t[0], t[1]]));
    const headingSum = new Map<string, number>();
    for (const t of [...r.headings, ...r.special]) headingSum.set(t[0].slice(0, 2), (headingSum.get(t[0].slice(0, 2)) ?? 0) + t[1]);
    for (const [ch, s] of headingSum) if (s > (chapterValue.get(ch) ?? 0)) fail(`${who} ${r.year} ${r.flow}: headings in chapter ${ch} sum to ${s}, more than the chapter (${chapterValue.get(ch) ?? 0})`);
    if (r.flow === "imports") for (const t of r.chapters) if (t[3] > 0 && t[2] === 0) fail(`${who} ${r.year} chapter ${t[0]}: duties without imports for consumption`);
  }
  if ((args.requireFullHistory ?? true) && build.firstYear !== PRODUCTS_START_YEAR) fail(`raw product files start in ${build.firstYear}, not ${PRODUCTS_START_YEAR} (run pnpm fetch:census-products)`);
  const natYears = new Set(build.national.map((r) => `${r.year}|${r.flow}`));
  for (let y = build.firstYear; y <= build.lastYear; y++) for (const f of ["exports", "imports"]) if (!natYears.has(`${y}|${f}`)) fail(`no all-countries ${f} for ${y}`);

  // Partners vs the goods file (country.xlsx, $M) and the duties file (same API, whole $).
  const goods = new Map(args.byCountry.map((r) => [`${r.country_code}|${r.year}`, r]));
  const duties = new Map(args.dutiesCountry.map((r) => [`${r.country_code}|${r.year}`, r]));
  let worstGoods: Gap | null = null;
  let worstGoodsAbs: Gap | null = null;
  let worstDuties: Gap | null = null;
  let worstConValue: Gap | null = null;
  let canadaExportsInProgress: Gap | null = null;
  const firstMonths = (a: (number | null)[], months: number, label: string) => {
    let s = 0;
    for (let m = 0; m < months; m++) {
      if (a[m] === null) fail(`${label}: month ${m + 1} is not published in the goods/duties file but the product data covers it (re-run pnpm fetch:census-trade)`);
      s += a[m]!;
    }
    return s;
  };
  const productKeys = new Set(build.rows.map((r) => `${r.country_code}|${r.year}`));
  for (const r of build.rows) {
    const k = `${r.country_code}|${r.year}`;
    const g = goods.get(k);
    const wantM = g ? (r.flow === "exports" ? (r.months === 12 ? g.exports_year : firstMonths(g.exports, r.months, `${k} exports`)) : r.months === 12 ? g.imports_year : firstMonths(g.imports, r.months, `${k} imports`)) : 0;
    const gap = gapOf(`${k} ${r.flow}`, r.value / MILLION, wantM);
    const canada = r.country_code === "CAN" && r.flow === "exports" && r.months < 12;
    if (canada) canadaExportsInProgress = gap;
    else {
      if (wantM >= 100) worstGoods = worse(worstGoods, gap); // smaller partners' shares are mostly the goods file's $0.1M rounding
      worstGoodsAbs = worseAbs(worstGoodsAbs, gap);
    }
    const share = canada ? PRODUCTS_TOL.canadaExportsInProgressShare : PRODUCTS_TOL.goodsShare;
    if (gap.gap * MILLION > Math.max(PRODUCTS_TOL.goodsAbs, share * wantM * MILLION)) {
      fail(`${k} ${r.flow}: chapters sum to $${(r.value / MILLION).toFixed(1)}M but trade_by_country says $${wantM.toFixed(1)}M`);
    }
    if (r.flow !== "imports") continue;
    const d = duties.get(k);
    const wantD = d ? (r.months === 12 ? d.duties_year : firstMonths(d.duties, r.months, `${k} duties`)) : 0;
    const wantV = d ? (r.months === 12 ? d.import_value_year : firstMonths(d.import_value, r.months, `${k} import value`)) : 0;
    const dg = gapOf(`${k} duties`, r.duties, wantD);
    const vg = gapOf(`${k} imports for consumption`, r.con_value, wantV);
    worstDuties = worse(worstDuties, dg);
    worstConValue = worse(worstConValue, vg);
    const slack = r.chapters.length;
    if (dg.gap > PRODUCTS_TOL.dutiesShare * wantD + slack) fail(`${k}: chapter duties sum to $${r.duties} but duties_by_country says $${wantD}`);
    if (vg.gap > PRODUCTS_TOL.dutiesShare * wantV + slack) fail(`${k}: chapter imports for consumption sum to $${r.con_value} but duties_by_country says $${wantV}`);
  }
  // A partner with goods or duties in a product year but no product rows at all.
  for (const g of args.byCountry) {
    if (g.year < build.firstYear || g.year > build.lastYear || productKeys.has(`${g.country_code}|${g.year}`)) continue;
    const c = known.get(g.country_code);
    if (c?.is_aggregate) continue;
    const months = g.year === build.lastYear ? build.lastMonth : 12;
    const total = g.exports.slice(0, months).reduce<number>((s, v) => s + (v ?? 0), 0) + g.imports.slice(0, months).reduce<number>((s, v) => s + (v ?? 0), 0);
    if (total * MILLION > PRODUCTS_TOL.goodsAbs) fail(`${g.country_code} ${g.year}: $${total.toFixed(1)}M of goods trade but no product rows`);
  }

  // Partners vs the all-countries row, per chapter-year.
  let worstCountrySum: Gap | null = null;
  const sums = new Map<string, number>();
  for (const r of build.rows) for (const t of r.chapters) sums.set(`${r.year}|${r.flow}|${t[0]}`, (sums.get(`${r.year}|${r.flow}|${t[0]}`) ?? 0) + t[1]);
  for (const r of build.national) {
    for (const t of r.chapters) {
      const k = `${r.year}|${r.flow}|${t[0]}`;
      const g = gapOf(k, sums.get(k) ?? 0, t[1]);
      worstCountrySum = worse(worstCountrySum, g);
      if (g.share > PRODUCTS_TOL.countrySumShare && g.gap > PRODUCTS_TOL.goodsAbs) fail(`${k}: partners sum to $${g.got} but the all-countries row is $${t[1]}`);
      sums.delete(k);
    }
  }
  for (const [k, v] of sums) if (v > PRODUCTS_TOL.goodsAbs) fail(`${k}: partners carry $${v} with no all-countries row`);

  // The partners behind each product: known countries, largest first, and never more than the all-countries row they sit under.
  const natValue = new Map<string, number>();
  for (const r of build.national) {
    for (const t of r.chapters) natValue.set(`${r.year}|${r.flow}|${t[0]}`, t[1]);
    for (const t of r.headings) natValue.set(`${r.year}|${r.flow}|${t[0]}`, t[1]);
  }
  if (build.partners.length !== build.national.length) fail(`${build.partners.length} partner rows for ${build.national.length} all-countries rows`);
  for (const r of build.partners) {
    for (const [level, lists] of [["chapter", r.chapters], ["heading", r.headings]] as const) {
      for (const [code, items] of Object.entries(lists)) {
        const list = items as readonly (readonly [string, number, ...number[]])[];
        const k = `${r.year}|${r.flow}|${code}`;
        const want = natValue.get(k);
        if (want === undefined) fail(`partners ${level} ${k} has no all-countries row`);
        let sum = 0;
        list.forEach((t, i) => {
          if (!known.get(t[0]) || known.get(t[0])!.is_aggregate) fail(`partners ${k}: ${t[0]} is not a non-aggregate countries.json code`);
          if (i > 0 && t[1] > list[i - 1][1]) fail(`partners ${k}: not largest first`);
          sum += t[1];
        });
        if (sum > want! * (1 + PRODUCTS_TOL.countrySumShare) + PRODUCTS_TOL.goodsAbs) fail(`partners ${level} ${k}: ${list.length} countries sum to $${sum}, more than the all-countries $${want}`);
        if (list.length === 0 && want! > PRODUCTS_TOL.goodsAbs) fail(`partners ${level} ${k}: no countries for $${want}`);
      }
    }
  }

  // All countries vs the World goods total (Census basis), full years only.
  let worstNational: Gap | null = null;
  const world = new Map(args.national.filter((r) => r.basis === "census" && r.frequency === "annual" && r.adjustment === "nsa").map((r) => [Number(r.period), r]));
  for (const r of build.national) {
    if (r.months !== 12) continue;
    const w = world.get(r.year);
    if (!w) fail(`no Census-basis World total for ${r.year}`);
    const g = gapOf(`${r.year} ${r.flow}`, r.value / MILLION, r.flow === "exports" ? w!.exports : w!.imports);
    worstNational = worse(worstNational, g);
    if (g.share > PRODUCTS_TOL.nationalShare) fail(`all countries ${r.year} ${r.flow}: chapters sum to $${g.got.toFixed(1)}M but the World total is $${g.want}M`);
  }

  // How much of each partner-year's goods value its kept headings cover (reported, not a gate).
  const cover: number[] = [];
  for (const r of build.rows) {
    const goodsValue = r.chapters.filter((t) => !isSpecialHs(t[0])).reduce((s, t) => s + t[1], 0);
    if (goodsValue >= 10 * MILLION) cover.push(r.headings.reduce((s, t) => s + t[1], 0) / goodsValue);
  }
  cover.sort((a, b) => a - b);
  const q = (p: number) => Math.round((cover[Math.floor(p * (cover.length - 1))] ?? 0) * 1000) / 1000;

  return { worstGoods, canadaExportsInProgress, worstGoodsAbs, worstDuties, worstConValue, worstCountrySum, worstNational, headingCoverage: { median: q(0.5), p10: q(0.1) } };
}
