/**
 * President page URLs: /presidency/presidents/<president_slug>. The slug is the `president_slug` every administrations
 * table already carries (`barack-obama`, `william-j-clinton`), so there is no second key. Pure and isomorphic.
 */
export const PRESIDENTS_PATH = "/presidency/presidents";

export const presidentPath = (slug: string) => `${PRESIDENTS_PATH}/${slug}`;

/**
 * Names as the term bands print them (`administrations.json`, `lib/troops-presidents.ts`, plus the Court data's forms) →
 * slug, for presidents with a page. Bands carry the name, not the slug, so a tapped band looks itself up here.
 */
const SLUG_BY_NAME: Readonly<Record<string, string>> = {
  "harry s. truman": "harry-s-truman",
  "harry s truman": "harry-s-truman",
  "dwight d. eisenhower": "dwight-d-eisenhower",
  "john f. kennedy": "john-f-kennedy",
  "lyndon b. johnson": "lyndon-b-johnson",
  "richard nixon": "richard-nixon",
  "richard m. nixon": "richard-nixon",
  "gerald ford": "gerald-ford",
  "jimmy carter": "jimmy-carter",
  "ronald reagan": "ronald-reagan",
  "george h. w. bush": "george-h-w-bush",
  "george h.w. bush": "george-h-w-bush",
  "bill clinton": "william-j-clinton",
  "william j. clinton": "william-j-clinton",
  "george w. bush": "george-w-bush",
  "barack obama": "barack-obama",
  "donald trump": "donald-trump",
  "donald j. trump": "donald-trump",
  "joe biden": "joe-biden",
  "joseph r. biden": "joe-biden",
};

/** The page for a president named as a band prints them, or null (Roosevelt and earlier have no page). */
export function presidentPathByName(name: string): string | null {
  const slug = SLUG_BY_NAME[name.trim().toLowerCase().replace(/\s+/g, " ")];
  return slug ? presidentPath(slug) : null;
}
