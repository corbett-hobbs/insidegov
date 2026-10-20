import { ENDUSE_LABELS, ENDUSE_SPECIAL, enduseLabel, isSpecialEnduse, type EnduseFlow } from "../../lib/trade-enduse-labels";
import {
  ENDUSE_START_YEAR,
  type TradeEnduseLabel,
  type TradeEnduseNationalRow,
  type TradeEndusePartnersRow,
  type TradeEnduseRow,
} from "../../lib/trade-enduse-entities";
import { TradeDataError, type CountryRow, type DutiesByCountryRow, type TradeByCountryRow, type TradeNationalRow } from "../../lib/trade-entities";
import type { TradeProductsRow } from "../../lib/trade-products-entities";
import type { RawEnduse, RawEnduseDescriptions } from "../fetch/census-enduse-lib";

/**
 * Goods by Census end-use category (pure; file I/O is in trade-run.ts). Source:
 * `pipeline/raw/census-trade/enduse/<flow>/<year>.json` (Census API, 5-digit end-use categories for every
 * partner). See docs/TRADE_METHODOLOGY.md ("Goods by use").
 */

/** Countries listed behind each category. */
export const ENDUSE_PARTNERS_PER_CATEGORY = 5;

/** Reconciliation tolerances. Tripping one fails the build; measured values in docs/TRADE_METHODOLOGY.md. */
export const ENDUSE_TOL = {
  /** A partner-year's categories vs its goods-file total (`trade_by_country`, $M to one decimal per month): the larger of an absolute gap in dollars and a share of the total. */
  goodsAbs: 1_000_000,
  goodsShare: 0.001,
  /** Exports to Canada in the year in progress: the goods file carries revisions the API does not have yet (same exception, same figure as the HS products files). */
  canadaExportsInProgressShare: 0.015,
  /** Categories' duties and imports for consumption vs `duties_by_country` (the same API): share of the total, plus $1 per category of rounding. */
  dutiesShare: 0.0005,
  /** A partner-year's categories vs the HS-chapter files (the same API, a different classification of the same shipments): share of the total, plus $1 per category/chapter of rounding. */
  productsShare: 0.0005,
  /** Partners' category rows vs the API's all-countries row, per category-year: share of the all-countries value. */
  countrySumShare: 0.002,
  /** All-countries categories vs the World goods total (Census basis, annual, $M). */
  nationalShare: 0.001,
};

type Values = number[];

interface Acc {
  months: number;
  categories: Map<string, Values>;
}

const add = (m: Map<string, Values>, code: string, v: Values) => {
  const have = m.get(code);
  m.set(code, have ? have.map((x, i) => x + v[i]) : [...v]);
};

const byValue = (a: [string, ...number[]], b: [string, ...number[]]) => b[1] - a[1] || a[0].localeCompare(b[0]);

export interface EnduseBuild {
  rows: TradeEnduseRow[];
  national: TradeEnduseNationalRow[];
  labels: TradeEnduseLabel[];
  partners: TradeEndusePartnersRow[];
  firstYear: number;
  lastYear: number;
  lastMonth: number;
}

function toRow(flow: EnduseFlow, year: number, acc: Acc) {
  const all = [...acc.categories].map(([c, v]) => [c, ...v] as [string, ...number[]]).filter((t) => t.slice(1).some((x) => x !== 0)).sort(byValue);
  const categories = all.filter((t) => !isSpecialEnduse(flow, t[0]));
  const special = all.filter((t) => isSpecialEnduse(flow, t[0]));
  const sum = (i: number) => all.reduce((s, t) => s + (t[i] as number), 0);
  if (flow === "exports") return { year, months: acc.months, flow, value: sum(1), categories, special } as Extract<TradeEnduseNationalRow, { flow: "exports" }>;
  return { year, months: acc.months, flow, value: sum(1), con_value: sum(2), duties: sum(3), categories, special } as Extract<TradeEnduseNationalRow, { flow: "imports" }>;
}

/**
 * The top countries behind every ranked category, per (year, flow), derived from the partners' own rows
 * (`perCountry`, keyed `${country_code}|${year}|${flow}`): every partner carries every category it trades, so the
 * ranking is exact. Former and unallocated partners compete like any other.
 */
function buildPartners(perCountry: Map<string, Acc>, national: TradeEnduseNationalRow[], n: number): TradeEndusePartnersRow[] {
  const byYearFlow = new Map<string, [string, Acc][]>();
  for (const [key, acc] of perCountry) {
    const [cc, y, flow] = key.split("|");
    byYearFlow.set(`${y}|${flow}`, [...(byYearFlow.get(`${y}|${flow}`) ?? []), [cc, acc]]);
  }
  return national.map((r) => {
    const accs = byYearFlow.get(`${r.year}|${r.flow}`) ?? [];
    const categories: Record<string, [string, ...number[]][]> = {};
    for (const t of r.categories) {
      categories[t[0]] = accs
        .flatMap(([cc, acc]) => {
          const v = acc.categories.get(t[0]);
          return v && v[0] > 0 ? [[cc, ...v] as [string, ...number[]]] : [];
        })
        .sort(byValue)
        .slice(0, n);
    }
    return { year: r.year, months: r.months, flow: r.flow, categories } as TradeEndusePartnersRow;
  });
}

export function buildEnduse(raws: RawEnduse[], countries: CountryRow[], desc: RawEnduseDescriptions): EnduseBuild {
  const toCountry = new Map(countries.map((c) => [c.census_code, c]));
  const perCountry = new Map<string, Acc>(); // `${country_code}|${year}|${flow}`
  const national = new Map<string, Acc>(); // `${year}|${flow}`
  const seen = new Set<string>();
  const monthsOfYear = new Map<number, number>();
  const usedCodes = new Set<string>(); // `${flow}|${code}`
  let lastYear = 0;
  let firstYear = Infinity;

  for (const raw of raws) {
    if (raw.year < ENDUSE_START_YEAR) throw new TradeDataError(`enduse ${raw.flow} ${raw.year}: before ${ENDUSE_START_YEAR}`);
    if (seen.has(`${raw.flow}|${raw.year}`)) throw new TradeDataError(`enduse: two raw files for ${raw.flow} ${raw.year}`);
    seen.add(`${raw.flow}|${raw.year}`);
    const m = monthsOfYear.get(raw.year);
    if (m !== undefined && m !== raw.through_month) throw new TradeDataError(`enduse ${raw.year}: exports cover ${m} months but imports ${raw.through_month}; re-run the fetch`);
    monthsOfYear.set(raw.year, raw.through_month);
    lastYear = Math.max(lastYear, raw.year);
    firstYear = Math.min(firstYear, raw.year);

    const rowSeen = new Set<string>();
    for (const [cty, code, ...vs] of raw.rows) {
      const k = `${cty}|${code}`;
      if (rowSeen.has(k)) throw new TradeDataError(`enduse ${raw.flow} ${raw.year}: duplicate row ${cty} ${code}`);
      rowSeen.add(k);
      if (!enduseLabel(raw.flow, code)) {
        throw new TradeDataError(`enduse ${raw.flow} ${raw.year}: category ${code} (${desc[raw.flow][code] ?? "?"}) has no label in lib/trade-enduse-labels.ts — name it deliberately`);
      }
      usedCodes.add(`${raw.flow}|${code}`);
      let acc: Acc;
      if (cty === "-") {
        const key = `${raw.year}|${raw.flow}`;
        acc = national.get(key) ?? { months: raw.through_month, categories: new Map() };
        national.set(key, acc);
      } else {
        const c = toCountry.get(cty);
        if (!c) throw new TradeDataError(`enduse: Census code ${cty} is not in countries.json`);
        if (c.is_aggregate) throw new TradeDataError(`enduse: aggregate code ${cty} in the raw rows`);
        const key = `${c.country_code}|${raw.year}|${raw.flow}`;
        acc = perCountry.get(key) ?? { months: raw.through_month, categories: new Map() };
        perCountry.set(key, acc);
      }
      add(acc.categories, code, vs);
    }
  }

  const rows: TradeEnduseRow[] = [];
  for (const [key, acc] of perCountry) {
    const [country_code, y, flow] = key.split("|");
    const r = toRow(flow as EnduseFlow, Number(y), acc);
    if (!r.categories.length && !r.special.length) continue;
    rows.push({ country_code, ...r });
  }
  rows.sort((a, b) => a.country_code.localeCompare(b.country_code) || a.year - b.year || a.flow.localeCompare(b.flow));
  const nat: TradeEnduseNationalRow[] = [...national].map(([key, acc]) => {
    const [y, flow] = key.split("|");
    return toRow(flow as EnduseFlow, Number(y), acc);
  });
  nat.sort((a, b) => a.year - b.year || a.flow.localeCompare(b.flow));

  const labels: TradeEnduseLabel[] = [...usedCodes].sort().map((fc) => {
    const [flow, code] = fc.split("|") as [EnduseFlow, string];
    const census_desc = desc[flow][code];
    if (!census_desc) throw new TradeDataError(`enduse: ${flow} category ${code} has no Census description in descriptions.json`);
    return { flow, code, label: enduseLabel(flow, code)!, census_desc, special: isSpecialEnduse(flow, code) };
  });
  const partners = buildPartners(perCountry, nat, ENDUSE_PARTNERS_PER_CATEGORY);
  return { rows, national: nat, labels, partners, firstYear, lastYear, lastMonth: monthsOfYear.get(lastYear) ?? 0 };
}

// -------------------------------------------------------------- validation

export interface Gap {
  key: string;
  got: number;
  want: number;
  gap: number;
  share: number;
}

export interface EnduseValidation {
  /** Largest share gap against the goods file among partner-years of $100M or more (Canada's year in progress apart). */
  worstGoods: Gap | null;
  canadaExportsInProgress: Gap | null;
  worstGoodsAbs: Gap | null;
  worstDuties: Gap | null;
  worstConValue: Gap | null;
  /** Against the HS-chapter files: every partner-year's value (exports, general imports), imports for consumption, duties. */
  worstProductsValue: Gap | null;
  worstProductsCon: Gap | null;
  worstProductsDuties: Gap | null;
  /** All-countries row vs the sum over partners, per category-year (share) and in dollars. */
  worstCountrySum: Gap | null;
  worstCountrySumAbs: Gap | null;
  /** All-countries row vs the sum over partners, per (year, flow) total: the unallocated gap. */
  worstCountrySumTotal: Gap | null;
  worstNational: Gap | null;
}

const worse = (a: Gap | null, b: Gap) => (!a || b.share > a.share ? b : a);
const worseAbs = (a: Gap | null, b: Gap) => (!a || b.gap > a.gap ? b : a);
const gapOf = (key: string, got: number, want: number): Gap => ({ key, got, want, gap: Math.abs(got - want), share: want ? Math.abs(got - want) / want : got ? 1 : 0 });

export function validateEnduse(args: {
  build: EnduseBuild;
  countries: CountryRow[];
  byCountry: TradeByCountryRow[];
  dutiesCountry: DutiesByCountryRow[];
  national: TradeNationalRow[];
  /** The HS-chapter rows the same partner-years are compared with. */
  products: TradeProductsRow[];
  /** False only for a trial over a few years (the fetch's `--since`); the build always requires 2010 on. */
  requireFullHistory?: boolean;
}): EnduseValidation {
  const { build, countries } = args;
  const fail = (m: string): never => {
    throw new TradeDataError(`enduse validation: ${m}`);
  };
  const known = new Map(countries.map((c) => [c.country_code, c]));
  const MILLION = 1e6;

  // Keys, schema-level invariants, coverage, labels.
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
    const codes = new Set<string>();
    for (const t of [...r.categories, ...r.special]) {
      if (codes.has(t[0])) fail(`${who} ${r.year} ${r.flow}: category ${t[0]} listed twice`);
      codes.add(t[0]);
    }
    for (const t of r.categories) if (isSpecialEnduse(r.flow, t[0])) fail(`${who} ${r.year} ${r.flow}: special entry ${t[0]} ranked as a category`);
    for (const t of r.special) if (!isSpecialEnduse(r.flow, t[0])) fail(`${who} ${r.year} ${r.flow}: ${t[0]} is not a special entry`);
    if (r.flow === "imports") for (const t of [...r.categories, ...r.special]) if (t[3] > 0 && t[2] === 0) fail(`${who} ${r.year} category ${t[0]}: duties without imports for consumption`);
  }
  if ((args.requireFullHistory ?? true) && build.firstYear !== ENDUSE_START_YEAR) fail(`raw end-use files start in ${build.firstYear}, not ${ENDUSE_START_YEAR} (run pnpm fetch:census-enduse)`);
  const natYears = new Set(build.national.map((r) => `${r.year}|${r.flow}`));
  for (let y = build.firstYear; y <= build.lastYear; y++) for (const f of ["exports", "imports"]) if (!natYears.has(`${y}|${f}`)) fail(`no all-countries ${f} for ${y}`);
  const labelKeys = new Set(build.labels.map((l) => `${l.flow}|${l.code}`));
  for (const flow of ["exports", "imports"] as const) {
    for (const code of [...Object.keys(ENDUSE_LABELS[flow]), ...Object.keys(ENDUSE_SPECIAL[flow])]) {
      if (!labelKeys.has(`${flow}|${code}`)) fail(`lib/trade-enduse-labels.ts names ${flow} category ${code}, which no data carries (remove it)`);
    }
  }

  // Partners vs the goods file (country.xlsx, $M), the duties file (same API, whole $), and the HS-chapter files.
  const goods = new Map(args.byCountry.map((r) => [`${r.country_code}|${r.year}`, r]));
  const duties = new Map(args.dutiesCountry.map((r) => [`${r.country_code}|${r.year}`, r]));
  const hs = new Map(args.products.map((r) => [`${r.country_code}|${r.year}|${r.flow}`, r]));
  let worstGoods: Gap | null = null;
  let worstGoodsAbs: Gap | null = null;
  let worstDuties: Gap | null = null;
  let worstConValue: Gap | null = null;
  let worstProductsValue: Gap | null = null;
  let worstProductsCon: Gap | null = null;
  let worstProductsDuties: Gap | null = null;
  let canadaExportsInProgress: Gap | null = null;
  const firstMonths = (a: (number | null)[], months: number, label: string) => {
    let s = 0;
    for (let m = 0; m < months; m++) {
      if (a[m] === null) fail(`${label}: month ${m + 1} is not published in the goods/duties file but the end-use data covers it (re-run pnpm fetch:census-trade)`);
      s += a[m]!;
    }
    return s;
  };
  const enduseKeys = new Set(build.rows.map((r) => `${r.country_code}|${r.year}`));
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
    const share = canada ? ENDUSE_TOL.canadaExportsInProgressShare : ENDUSE_TOL.goodsShare;
    if (gap.gap * MILLION > Math.max(ENDUSE_TOL.goodsAbs, share * wantM * MILLION)) {
      fail(`${k} ${r.flow}: categories sum to $${(r.value / MILLION).toFixed(1)}M but trade_by_country says $${wantM.toFixed(1)}M`);
    }

    // The same shipments under the HS chapters (same API, same bases): compare value, imports for consumption and duties.
    const p = hs.get(`${k}|${r.flow}`);
    const slack = r.categories.length + r.special.length;
    const pv = gapOf(`${k} ${r.flow} value`, r.value, p?.value ?? 0);
    worstProductsValue = worse(worstProductsValue, pv);
    if (pv.gap > ENDUSE_TOL.productsShare * (p?.value ?? 0) + slack) fail(`${k} ${r.flow}: categories sum to $${r.value} but the HS-chapter file says $${p?.value ?? 0}`);
    if (r.flow === "imports" && p?.flow === "imports") {
      const pc = gapOf(`${k} imports for consumption`, r.con_value, p.con_value);
      const pd = gapOf(`${k} duties`, r.duties, p.duties);
      worstProductsCon = worse(worstProductsCon, pc);
      worstProductsDuties = worse(worstProductsDuties, pd);
      if (pc.gap > ENDUSE_TOL.productsShare * p.con_value + slack) fail(`${k}: category imports for consumption sum to $${r.con_value} but the HS-chapter file says $${p.con_value}`);
      if (pd.gap > ENDUSE_TOL.productsShare * p.duties + slack) fail(`${k}: category duties sum to $${r.duties} but the HS-chapter file says $${p.duties}`);
    }

    if (r.flow !== "imports") continue;
    const d = duties.get(k);
    const wantD = d ? (r.months === 12 ? d.duties_year : firstMonths(d.duties, r.months, `${k} duties`)) : 0;
    const wantV = d ? (r.months === 12 ? d.import_value_year : firstMonths(d.import_value, r.months, `${k} import value`)) : 0;
    const dg = gapOf(`${k} duties`, r.duties, wantD);
    const vg = gapOf(`${k} imports for consumption`, r.con_value, wantV);
    worstDuties = worse(worstDuties, dg);
    worstConValue = worse(worstConValue, vg);
    if (dg.gap > ENDUSE_TOL.dutiesShare * wantD + slack) fail(`${k}: category duties sum to $${r.duties} but duties_by_country says $${wantD}`);
    if (vg.gap > ENDUSE_TOL.dutiesShare * wantV + slack) fail(`${k}: category imports for consumption sum to $${r.con_value} but duties_by_country says $${wantV}`);
  }
  // A partner with goods in an end-use year but no rows at all.
  for (const g of args.byCountry) {
    if (g.year < build.firstYear || g.year > build.lastYear || enduseKeys.has(`${g.country_code}|${g.year}`)) continue;
    if (known.get(g.country_code)?.is_aggregate) continue;
    const months = g.year === build.lastYear ? build.lastMonth : 12;
    const total = g.exports.slice(0, months).reduce<number>((s, v) => s + (v ?? 0), 0) + g.imports.slice(0, months).reduce<number>((s, v) => s + (v ?? 0), 0);
    if (total * MILLION > ENDUSE_TOL.goodsAbs) fail(`${g.country_code} ${g.year}: $${total.toFixed(1)}M of goods trade but no end-use rows`);
  }

  // Partners vs the all-countries row, per category-year and in total.
  let worstCountrySum: Gap | null = null;
  let worstCountrySumAbs: Gap | null = null;
  let worstCountrySumTotal: Gap | null = null;
  const sums = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const r of build.rows) {
    totals.set(`${r.year}|${r.flow}`, (totals.get(`${r.year}|${r.flow}`) ?? 0) + r.value);
    for (const t of [...r.categories, ...r.special]) sums.set(`${r.year}|${r.flow}|${t[0]}`, (sums.get(`${r.year}|${r.flow}|${t[0]}`) ?? 0) + t[1]);
  }
  for (const r of build.national) {
    worstCountrySumTotal = worse(worstCountrySumTotal, gapOf(`${r.year} ${r.flow}`, totals.get(`${r.year}|${r.flow}`) ?? 0, r.value));
    for (const t of [...r.categories, ...r.special]) {
      const k = `${r.year}|${r.flow}|${t[0]}`;
      const g = gapOf(k, sums.get(k) ?? 0, t[1]);
      worstCountrySum = worse(worstCountrySum, g);
      worstCountrySumAbs = worseAbs(worstCountrySumAbs, g);
      if (g.share > ENDUSE_TOL.countrySumShare && g.gap > ENDUSE_TOL.goodsAbs) fail(`${k}: partners sum to $${g.got} but the all-countries row is $${t[1]}`);
      sums.delete(k);
    }
  }
  for (const [k, v] of sums) if (v > ENDUSE_TOL.goodsAbs) fail(`${k}: partners carry $${v} with no all-countries row`);

  // The partners behind each category: known countries, largest first, never more than the all-countries row they sit under,
  // and the leaders really are the leaders (re-derived from the partner rows).
  const natValue = new Map<string, number>();
  for (const r of build.national) for (const t of r.categories) natValue.set(`${r.year}|${r.flow}|${t[0]}`, t[1]);
  if (build.partners.length !== build.national.length) fail(`${build.partners.length} partner rows for ${build.national.length} all-countries rows`);
  const leaders = new Map<string, number>(); // `${year}|${flow}|${code}` -> largest partner value
  for (const r of build.rows) for (const t of r.categories) leaders.set(`${r.year}|${r.flow}|${t[0]}`, Math.max(leaders.get(`${r.year}|${r.flow}|${t[0]}`) ?? 0, t[1]));
  for (const r of build.partners) {
    for (const [code, items] of Object.entries(r.categories)) {
      const list = items as readonly (readonly [string, number, ...number[]])[];
      const k = `${r.year}|${r.flow}|${code}`;
      const want = natValue.get(k);
      if (want === undefined) fail(`partners ${k} has no all-countries row`);
      let sum = 0;
      list.forEach((t, i) => {
        if (!known.get(t[0]) || known.get(t[0])!.is_aggregate) fail(`partners ${k}: ${t[0]} is not a non-aggregate countries.json code`);
        if (i > 0 && t[1] > list[i - 1][1]) fail(`partners ${k}: not largest first`);
        sum += t[1];
      });
      if (sum > want! * (1 + ENDUSE_TOL.countrySumShare) + ENDUSE_TOL.goodsAbs) fail(`partners ${k}: ${list.length} countries sum to $${sum}, more than the all-countries $${want}`);
      if (list.length === 0 && want! > ENDUSE_TOL.goodsAbs) fail(`partners ${k}: no countries for $${want}`);
      if (list.length && list[0][1] !== leaders.get(k)) fail(`partners ${k}: leader is $${list[0][1]} but the largest partner row is $${leaders.get(k)}`);
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
    if (g.share > ENDUSE_TOL.nationalShare) fail(`all countries ${r.year} ${r.flow}: categories sum to $${g.got.toFixed(1)}M but the World total is $${g.want}M`);
  }

  return { worstGoods, canadaExportsInProgress, worstGoodsAbs, worstDuties, worstConValue, worstProductsValue, worstProductsCon, worstProductsDuties, worstCountrySum, worstCountrySumAbs, worstCountrySumTotal, worstNational };
}
