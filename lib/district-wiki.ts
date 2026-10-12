/** Territories whose House seat is stored by postal code, not in `STATE_NAMES`. */
const TERRITORY_WIKI: Record<string, string> = {
  DC: "District of Columbia",
  PR: "Puerto Rico",
  GU: "Guam",
  AS: "American Samoa",
  MP: "Northern Mariana Islands",
  VI: "United States Virgin Islands",
};

const suffix = (n: number): string => {
  const v = n % 100;
  return n + (["th", "st", "nd", "rd"][(v - 20) % 10] || ["th", "st", "nd", "rd"][v] || "th");
};

/** Wikipedia article for a House seat, e.g. "California's 12th congressional district". */
export function districtWikiUrl(
  state: string,
  stateName: string,
  district: number | null,
): string {
  const place = TERRITORY_WIKI[state] ?? stateName;
  const title = `${place}'s ${district ? suffix(district) : "at-large"} congressional district`;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
