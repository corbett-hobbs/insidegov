import { REFUGEE_ALIASES } from "./refugee-country-names";
import { SPECIAL_ENTITIES, type NameTables } from "./removals-country-names";

/**
 * DHS Yearbook (country of birth) and quarterly-report (country of nationality) names -> the site's
 * `country_key` (the trade pipeline's `country_code`). Trade names are tried first; these aliases
 * cover the rest. Starts from the refugee aliases (which start from ICE's: `PSE` Palestine, `XKO`
 * Korea unspecified), and adds OHSS spellings.
 *
 * Historical entities are kept as printed, never split or guessed:
 *   - "Soviet Union (former)", "Czechoslovakia (former)", "Yugoslavia (former)" -> SUN / CSK / YUG
 *     (the trade crosswalk's former entities). OHSS prints them for people born there who gave no
 *     successor state.
 *   - "Serbia and Montenegro" -> SCG (the FY2008 edition's FY1999–FY2008 rows; its footnote: "Yugoslavia
 *     (unknown republic) prior to February 7, 2003").
 *   - "Korea" (FY2008 edition, "Includes both North and South Korea") -> KOR, as the FY2017 edition
 *     files the same numbers (see the alias below).
 *   - "Netherlands Antilles (former)" -> ANT.
 */
export const LPR_ALIASES: Readonly<Record<string, string>> = {
  ...REFUGEE_ALIASES,
  "american samoa": "ASM",
  czechia: "CZE",
  "czechoslovakia former": "CSK",
  "isle of man": "IMN",
  // The FY2008 Yearbook's "Korea" ("Includes both North and South Korea") is the FY2017 Yearbook's
  // South Korea for FY2008, footnoted "Data for South Korea prior to Fiscal Year 2009 include a small
  // number of cases from North Korea". Filed under KOR here (ICE and refugees use XKO for "Korea").
  korea: "KOR",
  "korea south": "KOR",
  "micronesia federated states": "FSM",
  "netherlands antilles former": "ANT",
  "saint martin french": "MAF",
  "serbia and montenegro former": "SCG",
  "slovak republic": "SVK",
  "soviet union former": "SUN",
  "u s virgin islands": "VIR",
  "virgin islands british": "VGB",
};

/**
 * Places OHSS prints as a country of birth that are not trade partners, so the trade crosswalk has
 * no row for them: U.S. territories, the United States itself (people born in the U.S. who are not
 * citizens, e.g. children of foreign diplomats), and two small dependencies. ISO alpha-3 codes.
 */
const LPR_SPECIALS: Readonly<Record<string, string>> = {
  USA: "United States",
  ASM: "American Samoa",
  VIR: "U.S. Virgin Islands",
  IMN: "Isle of Man",
  MAF: "Saint Martin (French part)",
};

export const LPR_NAME_TABLES: NameTables = {
  aliases: LPR_ALIASES,
  specials: { ...SPECIAL_ENTITIES, XTB: "Tibet", ...LPR_SPECIALS },
  aliasHome: "LPR_ALIASES in lpr-country-names.ts",
};
