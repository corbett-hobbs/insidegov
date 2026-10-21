import type { Legislator } from "./entities";

/**
 * Given names the upstream data lacks a `nickname` for, keyed by bioguide id:
 * the name the member is known and searched by (their Wikipedia article title),
 * including a middle or maiden name that is part of it ("Marjorie Taylor").
 */
const GIVEN_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  L000598: "Nick", // Nicolas LaLota
  C001131: "Greg", // Gregorio Casar
  H001094: "Val", // Valerie Hoyle
  // Senate
  L000570: "Ben Ray", // Ben Ray Luján
  C001088: "Chris", // Christopher Coons
  M001169: "Chris", // Christopher Murphy
  R000584: "Jim", // James Risch
  D000563: "Dick", // Richard Durbin
  C001047: "Shelley Moore", // Shelley Moore Capito
  // House
  O000175: "Andy", // Andrew Ogles
  L000596: "Anna Paulina", // Anna Paulina Luna
  R000600: "Amata Coleman", // Aumua Amata Coleman Radewagen
  M001204: "Dan", // Daniel Meuser
  B001292: "Don", // Donald Beyer
  D000230: "Don", // Donald Davis
  N000147: "Eleanor Holmes", // Eleanor Holmes Norton
  C001123: "Gil", // Gilbert Cisneros
  M001210: "Greg", // Gregory Murphy
  S001214: "Greg", // W. Gregory Steube
  C001136: "Herb", // Herbert Conaway
  B001307: "Jim", // James Baird
  V000133: "Jeff", // Jefferson Van Drew
  K000399: "Jen", // Jennifer Kiggans
  N000002: "Jerry", // Jerrold Nadler
  M001219: "James", // James Moylan (nickname "Jim" in the data; known as James)
  C001110: "Lou", // J. Luis Correa
  S000168: "María Elvira", // Maria Elvira Salazar
  G000596: "Marjorie Taylor", // Marjorie Taylor Greene
  S001205: "Mary Gay", // Mary Gay Scanlon
  L000599: "Mike", // Michael Lawler
  T000463: "Mike", // Michael Turner
  R000579: "Pat", // Patrick Ryan
  B001327: "Rob", // Robert Bresnahan
  L000566: "Bob", // Robert Latta
  M001226: "Rob", // Robert Menendez
  O000177: "Bob", // Robert Onder
  W000804: "Rob", // Robert Wittman
  S001201: "Tom", // Thomas Suozzi
  T000165: "Tom", // Thomas Tiffany
  K000402: "Tim", // Timothy Kennedy
  K000375: "Bill", // William Keating
};

/**
 * Surnames shortened to match `official_full`, keyed by bioguide id. The
 * upstream `last` holds the fuller legal surname.
 */
const FAMILY_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  G000608: "Graham", // Darline Graham Nordone
  H001103: "Hernández", // Pablo José Hernández Rivera
};

/** The surname a member goes by. */
export function familyName(
  name: Legislator["name"],
  bioguideId?: string,
): string {
  const override = bioguideId ? FAMILY_NAME_OVERRIDES[bioguideId] : undefined;
  return override ?? name.last;
}

/**
 * The first name a member goes by. Preference order:
 *  0. `GIVEN_NAME_OVERRIDES`
 *  1. `nickname` ("Chuck")
 *  2. a parenthetical inside `first` ("Charles (Chuck)" -> "Chuck")
 *  3. `middle` when `first` is only an initial ("J." + "French" -> "French")
 *  4. `first`
 */
export function givenName(
  name: Legislator["name"],
  bioguideId?: string,
): string {
  const override = bioguideId ? GIVEN_NAME_OVERRIDES[bioguideId] : undefined;
  if (override) return override;
  if (name.nickname) return name.nickname;
  const paren = name.first.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  const isInitial = /^(?:[A-Z]\.?)+$/.test(name.first);
  if (isInitial && name.middle && !/^(?:[A-Z]\.?)+$/.test(name.middle)) {
    return name.middle;
  }
  return name.first;
}

/** Display name, e.g. "French Hill" (given name + last, no suffix). */
export function displayName(
  name: Legislator["name"],
  bioguideId?: string,
): string {
  return `${givenName(name, bioguideId)} ${familyName(name, bioguideId)}`;
}
