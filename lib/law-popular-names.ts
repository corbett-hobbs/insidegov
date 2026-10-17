/**
 * Laws known by a popular or short title, keyed by law id. Wherever a law's title is shown, listed, searched or slugged, this
 * replaces the formal title ("An act to provide for reconciliation pursuant to …"). The law page keeps the formal one as
 * "Official title". Add a law here when its formal title does not say what it is.
 */
export const LAW_POPULAR_NAMES: Record<string, string> = {
  "119-pub-21": "One Big Beautiful Bill Act",
  "115-pub-97": "Tax Cuts and Jobs Act",
  "110-pub-343": "Emergency Economic Stabilization Act of 2008",
  "107-pub-56": "USA PATRIOT Act",
  "93-pub-153": "Trans-Alaska Pipeline Authorization Act",
  "96-pub-510": "Comprehensive Environmental Response, Compensation, and Liability Act (Superfund)",
  "94-pub-553": "Copyright Act of 1976",
  "96-pub-88": "Department of Education Organization Act",
  "94-pub-73": "Voting Rights Act Amendments of 1975",
  "97-pub-205": "Voting Rights Act Amendments of 1982",
  "98-pub-144": "Martin Luther King Jr. Federal Holiday Act",
  "106-pub-286": "U.S.-China Relations Act of 2000",
};

/** The rows with each popular-named law's title swapped in; other rows pass through untouched. */
export function withPopularNames<T extends { law_id: string; title: string }>(rows: T[]): T[] {
  return rows.map((r) => (LAW_POPULAR_NAMES[r.law_id] ? { ...r, title: LAW_POPULAR_NAMES[r.law_id] } : r));
}
