import { ICE_ALIASES, SPECIAL_ENTITIES, type NameTables } from "./removals-country-names";

/**
 * State Department (Refugee Processing Center) country-of-chargeability names, the country names
 * printed in the 2017–2026 entry-restriction instruments, and DHS yearbook names (cross-check
 * only) -> the site's `country_key` (the trade pipeline's `country_code`). Trade names are tried
 * first; these aliases cover the rest.
 * Starts from the ICE aliases (same conventions: `PSE` Palestine, `XUN`/`XST`), adds the State
 * Department's spellings, and one user-assigned code:
 *   XTB  Tibet   the State Department counts Tibetan refugees as their own chargeability row,
 *                separately from China; kept apart rather than folded into CHN.
 * "Gaza Strip" is the trade crosswalk's own `XGZ` (printed there as "Gaza Strip administered by
 * Israel"). "PA" (travel documents issued or endorsed by the Palestinian Authority, Proclamation
 * 10998) maps to `PSE`.
 */
export const REFUGEE_ALIASES: Readonly<Record<string, string>> = {
  ...ICE_ALIASES,
  "burkina faso uvolta": "BFA",
  "congo democratic republic": "COD",
  "congo republic": "COG",
  "cote d ivoire": "CIV",
  "dem rep congo": "COD",
  "gaza strip": "XGZ",
  "guinea bissau": "GNB",
  "korea north": "PRK",
  "korea republic of south": "KOR",
  "madagascar malagasy republic": "MDG",
  pa: "PSE",
  "republic of south sudan": "SSD",
  "republic of the congo": "COG",
  "sri lanka ceylon": "LKA",
  "the gambia": "GMB",
  tibet: "XTB",
  "union of soviet socialist republics": "SUN",
  "yemen sanaa": "YEM",
};

export const REFUGEE_NAME_TABLES: NameTables = {
  aliases: REFUGEE_ALIASES,
  specials: { ...SPECIAL_ENTITIES, XTB: "Tibet" },
  aliasHome: "REFUGEE_ALIASES in refugee-country-names.ts",
};
