/**
 * Decision page URLs: /supreme-court/decisions/<case_id>/<name-slug>.
 * `case_id` (SCDB's, `2021-001`) is canonical and resolves the page on its own; a wrong slug with a valid id redirects to the
 * canonical URL, like the law, member and justice routes. Pure and isomorphic.
 */
import { slugifyName } from "./member-url";

export const DECISIONS_BASE_PATH = "/supreme-court/decisions";
const MAX_SLUG = 70;

/** The case name as a slug ("et al." dropped), cut at a word boundary so a long caption stays a usable URL. */
export function decisionSlug(name: string): string {
  const full = slugifyName(name.replace(/,?\s+et\s+al\.?/gi, ""));
  if (!full) return "case";
  if (full.length <= MAX_SLUG) return full;
  const cut = full.slice(0, MAX_SLUG);
  const at = cut.lastIndexOf("-");
  return (at > 20 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

export const decisionPath = (caseId: string, name: string) => `${DECISIONS_BASE_PATH}/${caseId}/${decisionSlug(name)}`;

/** SCDB case ids are `<term>-<three digits>`. */
export const isCaseId = (raw: string): boolean => /^\d{4}-\d{3}$/.test(raw);
