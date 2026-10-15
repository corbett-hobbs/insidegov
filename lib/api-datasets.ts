import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fieldNamesOf, fieldTypesOf, type FieldType, type Row } from "./api-query";
import { siteUrl } from "./site";

/**
 * The public data catalog behind `/api/v1` and the MCP server at `/mcp`.
 *
 * Each entry is one table served from the pipeline's own normalized output
 * (`pipeline/output/`, DATA_CONVENTIONS §2): the rows the charts are built from, with the
 * pipeline's units and keys, before any page-shaped joining. Nothing is recomputed here.
 * To publish another file, add an entry; the API, the OpenAPI document, the MCP tools and
 * the catalog on `/api` all read this list.
 *
 * Left out on purpose: Wikipedia-derived text (bios, case summaries, landmark lists, CC BY-SA),
 * photos, per-law action histories and the 65 MB of per-filing line items. They stay on the pages.
 */

export type DatasetGroup = "presidency" | "congress" | "court";

export const GROUP_LABEL: Record<DatasetGroup, string> = {
  presidency: "Presidency",
  congress: "Congress",
  court: "Supreme Court",
};

export interface DatasetDef {
  /** URL-safe id, kebab-case. Never renamed once published. */
  id: string;
  title: string;
  group: DatasetGroup;
  /** The page whose charts are drawn from this table. */
  page: { label: string; href: string };
  description: string;
  /** What one row is. */
  grain: string;
  /** Units the numeric columns are in, when they are not obvious from the column. */
  units?: string;
  /** Who produced the underlying numbers. */
  sources: string[];
  /** Terms beyond "credit InsideGov", when the source sets some. */
  license?: string;
  /** Repo path of the write-up that explains the table. */
  doc?: string;
  /** Plain-language notes for columns that are not self-explanatory. */
  fieldNotes?: Record<string, string>;
  load: () => Row[];
}

const OUT = join(process.cwd(), "pipeline", "output");
const readJson = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));
const rows = (file: string): Row[] => readJson(file) as Row[];
const rowsAt = (file: string, key: string): Row[] => (readJson(file) as Record<string, Row[]>)[key];
/** Every `<dir>/<yyyy>.json` shard, oldest year first, as one table. */
const shards = (dir: string): Row[] =>
  readdirSync(join(OUT, dir))
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .flatMap((f) => rows(`${dir}/${f}`));

const FED_REG = "Office of the Federal Register, FederalRegister.gov";
const FRED = "Federal Reserve Bank of St. Louis, FRED®, from each series' own agency";
const EIA = "U.S. Energy Information Administration";
const CENSUS = "U.S. Census Bureau, Foreign Trade Division";
const OHSS = "U.S. Department of Homeland Security, Office of Homeland Security Statistics";
const ICE = "U.S. Immigration and Customs Enforcement";
const VOTEVIEW =
  "Lewis, Poole, Rosenthal, Boche, Rudkin and Sonnet (2026), Voteview: Congressional Roll-Call Votes Database, https://voteview.com/";
const CONGRESS_LEGISLATORS = "@unitedstates/congress-legislators (CC0)";
const SCDB = "Supreme Court Database, Version 2026 Release 01 (Spaeth, Epstein, Martin, Segal, Ruger, Benesh and Nelson)";
const SCDB_LICENSE =
  "Non-commercial use only: the Supreme Court Database is CC BY-NC 3.0 US. Cite it alongside InsideGov (http://supremecourtdatabase.org).";
const TROOPDATA_LICENSE =
  "Built on the troopdata package (Allen, Flynn and Martinez Machain 2022; GPL-3.0). Cite it alongside InsideGov.";

const DEFS: DatasetDef[] = [
  // ───────────────────────────── Presidency ─────────────────────────────
  {
    id: "executive-orders",
    title: "Executive orders",
    group: "presidency",
    page: { label: "Executive orders", href: "/presidency/executive-orders" },
    description: "Every executive order since 1994 with its signing date, issuing agencies, orders it amends or revokes, topic, and (from 2009) a short summary of what it does.",
    grain: "one executive order",
    sources: [FED_REG],
    fieldNotes: {
      eo_number: "The Federal Register's executive order number.",
      term_id: "Joins to administrations.term_id: the president in office when it was signed.",
      topic: "One of nine topic groups. topic_method says whether a person or a model assigned it; needs_review marks a low-confidence call.",
      summary: "What the order does, in one or two sentences, written by Claude (an AI model) from the order's Federal Register text and checked against it; not reviewed by a person. Null for orders signed before 2009-01-20.",
    },
    load: () => rows("executive_orders.json"),
  },
  {
    id: "administrations",
    title: "Presidential terms",
    group: "presidency",
    page: { label: "Executive orders", href: "/presidency/executive-orders" },
    description: "The presidential terms the Presidency pages are banded by, with party and start and end dates.",
    grain: "one uninterrupted presidential tenure",
    sources: [FED_REG],
    fieldNotes: { term_id: "The inauguration date. Other Presidency tables carry it to say who was in office." },
    load: () => rows("administrations.json"),
  },
  {
    id: "economic-indicator-series",
    title: "Economic indicators: series",
    group: "presidency",
    page: { label: "Economy", href: "/presidency/economy" },
    description: "The catalog of economic series on the Economy page (jobs, inflation, gas prices and more): title, units, frequency, source agency and caveats.",
    grain: "one series",
    sources: [FRED],
    doc: "docs/INDICATORS_METHODOLOGY.md",
    load: () => rows("indicator_series.json"),
  },
  {
    id: "economic-indicator-observations",
    title: "Economic indicators: observations",
    group: "presidency",
    page: { label: "Economy", href: "/presidency/economy" },
    description: "The full history of every Economy-page series at its source frequency, in raw levels.",
    grain: "one series on one date",
    units: "The series' own units (see economic-indicator-series.units).",
    sources: [FRED],
    doc: "docs/INDICATORS_METHODOLOGY.md",
    fieldNotes: { series_id: "Joins to economic-indicator-series.series_id." },
    load: () => rows("indicator_observations.json"),
  },
  {
    id: "energy-series",
    title: "Energy: series",
    group: "presidency",
    page: { label: "Energy", href: "/presidency/energy" },
    description: "The catalog of the 20 petroleum, Strategic Petroleum Reserve, natural gas and electricity series: title, units, frequency, group and caveats.",
    grain: "one series",
    sources: [EIA],
    doc: "docs/ENERGY_METHODOLOGY.md",
    load: () => rows("energy_series.json"),
  },
  {
    id: "energy-observations",
    title: "Energy: observations",
    group: "presidency",
    page: { label: "Energy", href: "/presidency/energy" },
    description: "Monthly and annual history of every Energy-page series from 1973, in source units. Recent months are marked preliminary.",
    grain: "one series on one date",
    units: "The series' own units (see energy-series.units).",
    sources: [EIA],
    doc: "docs/ENERGY_METHODOLOGY.md",
    fieldNotes: { series_id: "Joins to energy-series.series_id.", status: "final, or preliminary while EIA may still revise it." },
    load: () => rows("energy_observations.json"),
  },
  {
    id: "energy-actions",
    title: "Energy: policy actions",
    group: "presidency",
    page: { label: "Energy", href: "/presidency/energy" },
    description: "The curated policy actions flagged on the Energy charts: Strategic Petroleum Reserve sales and refills, pipeline and LNG decisions, statutes and executive orders.",
    grain: "one action",
    sources: ["Curated by InsideGov from primary government sources"],
    doc: "docs/ENERGY_ACTIONS_CURATION.md",
    load: () => rowsAt("energy_actions.json", "actions"),
  },
  {
    id: "trade-national",
    title: "Trade: national totals",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "U.S. goods exports, imports and the trade balance, monthly and annual, 1991 onward.",
    grain: "one period (month or year)",
    units: "Millions of U.S. dollars.",
    sources: [CENSUS],
    doc: "docs/TRADE_METHODOLOGY.md",
    fieldNotes: { period: "YYYY for annual rows, YYYY-MM for monthly rows; frequency says which." },
    load: () => rows("trade_national.json"),
  },
  {
    id: "trade-partners",
    title: "Trade: partners",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "The list of trading partners and aggregates (countries, former countries, regions such as the European Union) and their codes.",
    grain: "one partner",
    sources: [CENSUS],
    doc: "docs/TRADE_METHODOLOGY.md",
    fieldNotes: { country_code: "Joins to trade-by-country and duties-by-country.", is_aggregate: "True for groups such as the European Union." },
    load: () => rows("countries.json"),
  },
  {
    id: "trade-by-country",
    title: "Trade: by partner and year",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "Goods exports and imports with each partner, with twelve monthly values and the year's total.",
    grain: "one partner in one year",
    units: "Millions of U.S. dollars. The monthly arrays run January to December; null means not yet published.",
    sources: [CENSUS],
    doc: "docs/TRADE_METHODOLOGY.md",
    load: () => shards("trade_by_country"),
  },
  {
    id: "duties-national",
    title: "Duties: national",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "Calculated import duties and import value by month, and the effective duty rate (duties as a share of imports).",
    grain: "one month",
    units: "Whole U.S. dollars; rate is a fraction (0.03 = 3%).",
    sources: [CENSUS, "U.S. International Trade Commission, DataWeb (1993–2009)"],
    doc: "docs/TRADE_METHODOLOGY.md",
    load: () => rows("duties_national.json"),
  },
  {
    id: "duties-by-country",
    title: "Duties: by partner and year",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "Calculated duties, import value and effective rate for each partner, with twelve monthly values.",
    grain: "one partner in one year",
    units: "Whole U.S. dollars; rate is a fraction. The monthly arrays run January to December.",
    sources: [CENSUS, "U.S. International Trade Commission, DataWeb (1993–2009)"],
    doc: "docs/TRADE_METHODOLOGY.md",
    load: () => shards("duties_by_country"),
  },
  {
    id: "tariff-actions",
    title: "Trade: tariff actions",
    group: "presidency",
    page: { label: "Trade", href: "/presidency/trade" },
    description: "The curated tariff actions flagged on the Trade charts: dates, authority, products and countries covered.",
    grain: "one action",
    sources: ["Curated by InsideGov from primary government sources"],
    doc: "docs/TARIFF_ACTIONS_CURATION.md",
    load: () => rowsAt("tariff_actions.json", "actions"),
  },
  {
    id: "foreign-assistance",
    title: "Foreign assistance",
    group: "presidency",
    page: { label: "Foreign aid", href: "/presidency/foreign-aid" },
    description: "U.S. foreign assistance by recipient, fiscal year and sector: disbursements, obligations and the military share.",
    grain: "one recipient, fiscal year and sector",
    units: "Nominal (current-year) U.S. dollars.",
    sources: ["ForeignAssistance.gov, U.S. Department of State"],
    doc: "docs/FOREIGN_AID_METHODOLOGY.md",
    load: () => rows("foreign_assistance.json"),
  },
  {
    id: "troops-by-location",
    title: "Troops abroad: by location (2008–)",
    group: "presidency",
    page: { label: "National security", href: "/presidency/national-security" },
    description: "Active-duty personnel by place of duty and branch, from DMDC quarterly reports.",
    grain: "one location in one period",
    units: "People. The series changes meaning in Dec 2017 (permanent assignment only); state tells you when a value is not reported.",
    sources: ["U.S. Department of Defense, Defense Manpower Data Center"],
    doc: "docs/TROOPS_METHODOLOGY.md",
    fieldNotes: { state: "value, suppressed (DMDC withheld the figure) or null (not reported, e.g. Afghanistan, Iraq and Syria Dec 2017–Sep 2021). Neither is zero." },
    load: () => rows("troops_location.json"),
  },
  {
    id: "troops-history",
    title: "Troops abroad: history (1950–2007)",
    group: "presidency",
    page: { label: "National security", href: "/presidency/national-security" },
    description: "Active-duty personnel abroad by country and branch before 2008. Not like-for-like with the 2008-on location table.",
    grain: "one country in one year",
    units: "People.",
    sources: ["troopdata (Allen, Flynn and Martinez Machain 2022; Kane 2005)", "U.S. Department of Defense, DMDC 309A tables"],
    license: TROOPDATA_LICENSE,
    doc: "docs/TROOPS_METHODOLOGY.md",
    fieldNotes: { quality: "reported, or estimate (2006–07).", state: "value, or suppressed where DMDC withheld the figure." },
    load: () => rows("troops_history.json"),
  },
  {
    id: "military-bases",
    title: "Known overseas installations",
    group: "presidency",
    page: { label: "National security", href: "/presidency/national-security" },
    description: "Known U.S. military installations abroad with coordinates. An undated snapshot with no headcounts; newer and unacknowledged sites are missing.",
    grain: "one installation",
    sources: ["David Vine's lists of U.S. military bases abroad, via troopdata"],
    license: TROOPDATA_LICENSE,
    doc: "docs/TROOPS_METHODOLOGY.md",
    fieldNotes: { x: "Map position on the site's world map; use lat and lon.", y: "Map position on the site's world map; use lat and lon." },
    load: () => rows("bases.json"),
  },
  {
    id: "enforcement-series",
    title: "Immigration enforcement",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "ICE removals, arrests, detainers, book-ins and detention population by fiscal year, with the administration in office and notes on definition changes.",
    grain: "one metric in one period (some split by agency or criminality)",
    units: "People (detention_adp is the average daily population).",
    sources: [ICE],
    doc: "docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md",
    fieldNotes: { note_ids: "Definition changes that apply to the value.", administration_term_id: "Joins to administrations.term_id." },
    load: () => rows("enforcement_series.json"),
  },
  {
    id: "removals-by-country",
    title: "Removals by country",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "ICE removals by country of citizenship and fiscal year.",
    grain: "one country in one fiscal year",
    units: "People.",
    sources: [ICE],
    doc: "docs/IMMIGRATION_ENFORCEMENT_METHODOLOGY.md",
    fieldNotes: { country_key: "ISO alpha-3 code.", needs_review: "True where the source table was hard to read; parse_confidence says how hard." },
    load: () => rows("removals_by_country.json"),
  },
  {
    id: "lpr-series",
    title: "Green cards: totals",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "People granted lawful permanent resident status by fiscal year, optionally split by admission type or class of admission.",
    grain: "one metric in one fiscal year (and admission type or class)",
    units: "People.",
    sources: [OHSS],
    doc: "docs/LPR_METHODOLOGY.md",
    load: () => rows("lpr_series.json"),
  },
  {
    id: "lpr-by-country",
    title: "Green cards: by country",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Lawful permanent residents by country of birth or nationality and fiscal year, with the yearbook table each value was read from.",
    grain: "one country, metric and basis in one fiscal year",
    units: "People.",
    sources: [OHSS],
    doc: "docs/LPR_METHODOLOGY.md",
    load: () => rows("lpr_by_country.json"),
  },
  {
    id: "lpr-by-region",
    title: "Green cards: by region",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Lawful permanent residents by world region and fiscal year.",
    grain: "one region, metric and basis in one fiscal year",
    units: "People.",
    sources: [OHSS],
    doc: "docs/LPR_METHODOLOGY.md",
    load: () => rows("lpr_by_region.json"),
  },
  {
    id: "refugee-series",
    title: "Refugee admissions: totals",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Refugees admitted each fiscal year against the presidential ceiling, with the administration in office.",
    grain: "one fiscal year",
    units: "People.",
    sources: ["U.S. Department of State, Refugee Processing Center (admissions)", "Presidential Determinations, Federal Register (ceilings)"],
    doc: "docs/REFUGEE_ADMISSIONS_METHODOLOGY.md",
    fieldNotes: { ceiling: "The ceiling in force at year end; null where none is recorded.", ceiling_initial: "The ceiling first set, before any revision.", share_of_ceiling: "admissions divided by ceiling." },
    load: () => rows("refugee_series.json"),
  },
  {
    id: "refugee-by-country",
    title: "Refugee admissions: by country",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Refugee admissions by country of nationality and fiscal year.",
    grain: "one country in one fiscal year",
    units: "People.",
    sources: ["U.S. Department of State, Refugee Processing Center"],
    doc: "docs/REFUGEE_ADMISSIONS_METHODOLOGY.md",
    load: () => rows("refugee_by_country.json"),
  },
  {
    id: "refugee-by-region",
    title: "Refugee admissions: by region",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Refugee admissions by world region and fiscal year, with the regional allocations the President set.",
    grain: "one region in one fiscal year",
    units: "People.",
    sources: ["U.S. Department of State, Refugee Processing Center"],
    doc: "docs/REFUGEE_ADMISSIONS_METHODOLOGY.md",
    load: () => rows("refugee_regions.json"),
  },
  {
    id: "refugee-monthly",
    title: "Refugee admissions: by month",
    group: "presidency",
    page: { label: "Immigration", href: "/presidency/immigration" },
    description: "Refugee admissions by month.",
    grain: "one month",
    units: "People.",
    sources: ["U.S. Department of State, Refugee Processing Center"],
    doc: "docs/REFUGEE_ADMISSIONS_METHODOLOGY.md",
    load: () => rows("refugee_monthly.json"),
  },

  // ───────────────────────────── Congress ─────────────────────────────
  {
    id: "legislators",
    title: "Legislators",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "Every person who has served in Congress, with name, birth year and gender. Identity only: nothing that changes by Congress.",
    grain: "one person",
    sources: [CONGRESS_LEGISLATORS],
    doc: "docs/DATA_CONVENTIONS.md",
    fieldNotes: { bioguide_id: "The Biographical Directory of the United States Congress id. It joins every Congress table." },
    load: () => rows("legislators.json"),
  },
  {
    id: "terms",
    title: "Congressional terms",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "State, district, party and caucus for each member in each Congress and chamber.",
    grain: "one member, Congress and chamber",
    sources: [CONGRESS_LEGISLATORS],
    doc: "docs/DATA_CONVENTIONS.md",
    fieldNotes: { district: "House district number; null for at-large seats, delegates and the Senate." },
    load: () => rows("terms.json"),
  },
  {
    id: "ideology-scores",
    title: "Ideology scores (DW-NOMINATE)",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "Each member's two-dimensional DW-NOMINATE and Nokken-Poole scores in each Congress, 1st through 119th.",
    grain: "one member, Congress and chamber",
    units: "Scores run about -1 to +1; dimension 1 is the liberal-conservative axis.",
    sources: [VOTEVIEW],
    doc: "docs/DATA_CONVENTIONS.md",
    fieldNotes: {
      nominate_dim1: "Career-fixed position, liberal (-) to conservative (+).",
      nokken_poole_dim1: "Position estimated from that Congress alone.",
      n_votes: "Roll-call votes the member cast that Congress.",
      party_code: "Voteview's own party code.",
    },
    load: () => rows("ideology_scores.json"),
  },
  {
    id: "committees",
    title: "Committees",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "The 49 standing, select and joint committees of the 119th Congress.",
    grain: "one committee",
    sources: [CONGRESS_LEGISLATORS],
    load: () => rows("committees.json"),
  },
  {
    id: "subcommittees",
    title: "Subcommittees",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "Subcommittees of the 119th Congress and their parent committees.",
    grain: "one subcommittee",
    sources: [CONGRESS_LEGISLATORS],
    load: () => rows("subcommittees.json"),
  },
  {
    id: "committee-memberships",
    title: "Committee memberships",
    group: "congress",
    page: { label: "Ideology", href: "/congress/ideology" },
    description: "Who sits on which committee in the 119th Congress, with party side, role and rank.",
    grain: "one member on one committee",
    sources: [CONGRESS_LEGISLATORS],
    fieldNotes: { party: "majority or minority side.", rank: "Seniority order on the committee." },
    load: () => rows("committee_memberships.json"),
  },
  {
    id: "laws",
    title: "Public laws",
    group: "congress",
    page: { label: "Laws", href: "/congress/laws" },
    description: "Every public law since the 93rd Congress (1973): signing date, title, bill, sponsor, policy area, vote counts and a one-sentence summary.",
    grain: "one public law",
    sources: ["Congress.gov and GovInfo (Library of Congress, CRS summaries)", VOTEVIEW, "David R. Mayhew, Divided We Govern (major laws)"],
    doc: "docs/LAWS_METHODOLOGY.md",
    fieldNotes: {
      sponsor_bioguide_id: "Joins to legislators.bioguide_id.",
      area_id: "Policy area. Commemorative laws are grouped as commemorations; crs_area_id keeps the CRS area.",
      band: "Support for final passage, from the narrowest recorded vote: 0 voice vote or consent, 1 under 60% yes, 2 60–75%, 3 75–90%, 4 90% and over.",
      house: "Final-passage vote as [kind, yea, nay, roll]; kind is 0 roll call, 1 voice, 2 unanimous consent, 3 method not stated. senate is the same.",
      major: "True if Mayhew lists the law as a major enactment. Covers through the 118th Congress.",
    },
    load: () => rows("laws.json"),
  },
  {
    id: "laws-counts",
    title: "Laws per Congress and policy area",
    group: "congress",
    page: { label: "Laws", href: "/congress/laws" },
    description: "How many laws each Congress passed in each policy area, split by breadth of support.",
    grain: "one Congress and policy area",
    sources: ["Congress.gov and GovInfo", VOTEVIEW],
    doc: "docs/LAWS_METHODOLOGY.md",
    fieldNotes: { bands: "Laws per support band, adding up to n.", major: "How many of the n are Mayhew-listed major laws." },
    load: () => rows("laws_counts.json"),
  },
  {
    id: "financial-disclosures",
    title: "Financial disclosures: net worth estimates",
    group: "congress",
    page: { label: "Wealth", href: "/congress/wealth" },
    description: "Estimated assets, liabilities and net worth for members of Congress by reporting year, from the value bands on their annual disclosures.",
    grain: "one member and reporting year",
    units: "U.S. dollars, estimated from band midpoints; the top open-ended band counts at its floor.",
    sources: ["Clerk of the U.S. House of Representatives; Secretary of the Senate, Financial Disclosure reports"],
    doc: "docs/NET_WORTH_METHODOLOGY.md",
    fieldNotes: {
      year: "The year the report covers, not the year it was filed.",
      has_open_ended_asset: "True if any asset is in the open-ended top band, so net worth is a floor.",
      needs_review: "True where the extraction needs a human check; parse_confidence says how sure it was.",
    },
    load: () => rows("financial_disclosures.json"),
  },

  // ───────────────────────────── Supreme Court ─────────────────────────────
  {
    id: "justices",
    title: "Justices",
    group: "court",
    page: { label: "Ideology", href: "/supreme-court/ideology" },
    description: "Every justice with appointing president, party, nomination and confirmation dates, Senate vote and service dates.",
    grain: "one justice",
    sources: ["Federal Judicial Center, Biographical Directory of Article III Federal Judges", SCDB],
    fieldNotes: { justice_id: "The Supreme Court Database id; it joins the Court tables." },
    load: () => rows("court/justices.json"),
  },
  {
    id: "martin-quinn-scores",
    title: "Justice ideology scores (Martin-Quinn)",
    group: "court",
    page: { label: "Ideology", href: "/supreme-court/ideology" },
    description: "Each justice's estimated ideal point by term, with its uncertainty.",
    grain: "one justice and term",
    units: "Negative is liberal, positive is conservative. Not on the DW-NOMINATE scale: compare within this table only.",
    sources: ["Martin and Quinn, Martin-Quinn scores (mqscores.wustl.edu)"],
    doc: "docs/SCOTUS_DATA_METHODOLOGY.md",
    fieldNotes: { mq_lo95: "Lower end of the 95% interval.", mq_hi95: "Upper end of the 95% interval." },
    load: () => rows("court/mq_scores.json"),
  },
  {
    id: "court-terms",
    title: "The Court's median by term",
    group: "court",
    page: { label: "Ideology", href: "/supreme-court/ideology" },
    description: "The median justice's score each term, with the most liberal and most conservative scores and who held the middle.",
    grain: "one term (or part of a term when the bench changed)",
    sources: ["Martin and Quinn, Martin-Quinn scores (mqscores.wustl.edu)"],
    doc: "docs/SCOTUS_DATA_METHODOLOGY.md",
    fieldNotes: { segment: "a or b when the bench changed mid-term; blank otherwise." },
    load: () => rows("court/court_terms.json"),
  },
  {
    id: "decisions-cases",
    title: "Supreme Court decisions",
    group: "court",
    page: { label: "Decisions", href: "/supreme-court/decisions" },
    description: "Every argued case since 1946 with date, citation, issue area, vote split and the direction of the outcome.",
    grain: "one case",
    sources: [SCDB],
    license: SCDB_LICENSE,
    doc: "docs/DECISIONS_METHODOLOGY.md",
    fieldNotes: {
      band: "Dissents, capped at 4: 0 unanimous (9–0), 1 = 8–1, 2 = 7–2, 3 = 6–3, 4 = 5–4 or closer. It counts dissents, not the full tally.",
      maj: "Justices in the majority.",
      min: "Justices in the minority.",
      direction: "liberal or conservative outcome, from SCDB's decisionDirection; null where SCDB does not code one.",
    },
    load: () => rows("decisions_cases.json"),
  },
  {
    id: "decisions-counts",
    title: "Decisions per term and issue area",
    group: "court",
    page: { label: "Decisions", href: "/supreme-court/decisions" },
    description: "How many cases each term decided in each issue area, bucketed by how many justices dissented.",
    grain: "one term and issue area",
    sources: [SCDB],
    license: SCDB_LICENSE,
    doc: "docs/DECISIONS_METHODOLOGY.md",
    fieldNotes: { n: "Cases.", d0: "Cases with no dissent.", d4: "Cases with four or more dissents.", issue_area_id: "Null means unclassified." },
    load: () => rows("decisions_counts.json"),
  },
];

export const ATTRIBUTION_NAME = "InsideGov";
export const ATTRIBUTION_TEXT = `Data from InsideGov (${siteUrl}). Please credit InsideGov when you use it.`;
export const TERMS_URL = `${siteUrl}/api`;

const byId = new Map(DEFS.map((d) => [d.id, d]));

export interface LoadedDataset {
  def: DatasetDef;
  rows: Row[];
  fields: string[];
  types: Record<string, FieldType>;
}

const cache = new Map<string, LoadedDataset>();

export const listDatasetDefs = (): readonly DatasetDef[] => DEFS;
export const getDatasetDef = (id: string): DatasetDef | undefined => byId.get(id);

/** Reads and indexes one table on first use; later requests on a warm instance reuse it. */
export function loadDataset(id: string): LoadedDataset | null {
  const def = byId.get(id);
  if (!def) return null;
  let hit = cache.get(id);
  if (!hit) {
    const data = def.load();
    const fields = fieldNamesOf(data);
    hit = { def, rows: data, fields, types: fieldTypesOf(data, fields) };
    cache.set(id, hit);
  }
  return hit;
}
