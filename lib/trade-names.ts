/**
 * Display names for trade partners. Census's partner names carry legal
 * qualifiers ("Germany (Federal Republic of Germany)"); the page shows the
 * name people use. Keyed by `country_code`, only where Census's name needs it.
 * Anything not listed passes through unchanged.
 */
const DISPLAY: Record<string, string> = {
  FLK: "Falkland Islands",
  DNK: "Denmark",
  DEU: "Germany",
  MDA: "Moldova",
  VAT: "Vatican City",
  YUG: "Yugoslavia",
  SYR: "Syria",
  YEM: "Yemen",
  MMR: "Myanmar",
  LAO: "Laos",
  PRK: "North Korea",
  KOR: "South Korea",
  CCK: "Cocos (Keeling) Islands",
  CXR: "Christmas Island",
  WSM: "Samoa",
  FSM: "Micronesia",
  COG: "Republic of the Congo",
  COD: "Democratic Republic of the Congo",
  TZA: "Tanzania",
  XGZ: "Gaza Strip",
  XWB: "West Bank",
  SUN: "Soviet Union",
  UNALLOC_8220: "Unidentified countries",
  UNALLOC_8500: "International organizations",
};

/**
 * Short forms for the countries people abbreviate, keyed by ISO alpha-3 `country_code`. A chart that cannot fit a country's
 * full name tries this next, and falls back to the three-letter ISO code only for a country with no short form here (ISO has
 * no code that reads "DRC": `COD` is the standard, "DRC" is the abbreviation readers know). Add a country when its code
 * would read worse than its short form; never abbreviate a name that is already short.
 */
const SHORT: Record<string, string> = {
  COD: "DRC",
  COG: "Rep. Congo",
  ARE: "UAE",
  GBR: "UK",
  USA: "US",
  ZAF: "S. Africa",
  KOR: "S. Korea",
  PRK: "N. Korea",
  SSD: "S. Sudan",
  CAF: "C.A.R.",
  DOM: "Dom. Rep.",
  BIH: "Bosnia",
  MKD: "N. Macedonia",
  PNG: "PNG",
};

/** The short form of a country, or undefined when it has none (then the ISO code is the last resort). */
export function shortCountryName(code: string): string | undefined {
  return SHORT[code];
}

export function displayCountryName(code: string, censusName: string): string {
  return DISPLAY[code] ?? censusName;
}
