import { splitSentences } from "./trim";

/**
 * A committee's description is built from the article's whole lead section (the
 * REST summary endpoint returns only its first paragraph, which is often just
 * "X is a standing committee of the Senate"): the lead's own sentences, in order,
 * never reworded. The first sentence names the committee; up to two more are kept
 * if they say what it does (`ROLE`). Left out: a sentence that names the current
 * chair or counts members (the page shows both from our own data; Wikipedia's go
 * stale) and trivia (`NOISE`). A committee whose lead never says what it does gets
 * no record: the page then has no About block, never a placeholder.
 */
const MAX_CHARS = 520;
/** One sentence on its own may run a little longer (Finance's jurisdiction list). */
const MAX_LONE_ROLE_CHARS = 600;
const STALE = /\b(chair(ed|man|woman|person)?|ranking member|vice chair|\d+ members|members of (this|the) committee)\b/i;
const NOISE = /earmark|pork|office building|subpoena|criticis|subcommittees\b|housed|located|\$[\d,]+|per capita|\bthese (major|issues)\b/i;
const ROLE = /jurisdiction|responsib|oversight|oversee|charged|deals with|concerns itself|considers|studies|investigat|legislative|rules under|monitor|tax-writing/i;

export function describe(lead: string): string | null {
  const all = splitSentences(lead.replace(/\s+/g, " ").trim());
  const ok = all.filter((s) => !STALE.test(s) && !NOISE.test(s));
  if (ok.length === 0) return null;
  const roles = ok.filter((s) => ROLE.test(s));
  // Identity sentence first, then role sentences in order while they fit.
  const kept = all[0] && ok[0] === all[0] ? [ok[0]] : [];
  for (const s of roles) {
    if (kept.includes(s) || kept.length === 3) continue;
    if ([...kept, s].join(" ").length <= MAX_CHARS) kept.push(s);
  }
  if (!kept.some((s) => ROLE.test(s))) {
    const lone = roles.find((s) => s.length <= MAX_LONE_ROLE_CHARS);
    if (lone) return lone;
    // No sentence says what it does: keep two or more of the lead's own sentences only if
    // together they say something real (a history line is still more than a bare "is a committee").
    const text = ok.slice(0, 3).join(" ");
    return ok.length >= 2 && text.length >= 250 && text.length <= MAX_CHARS ? text : null;
  }
  return kept.join(" ");
}
