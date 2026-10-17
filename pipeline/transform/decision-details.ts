import { parse as parseCsv } from "csv-parse/sync";
import { DecisionsDataError, type CaseLeadRow, type DecisionDetailRow, type ScdbCodebook } from "../../lib/decisions-entities";
import { splitSentences } from "./wikipedia-case-summaries";

/**
 * Per-case details for the decision pages (`decisions_details.json`): the parties, the courts the case came through, why the
 * Court took it, when it was argued, what it decided and under which law, read from the same SCDB case-centered release as the
 * case list and labelled with the codebook's own wording (`pipeline/reference/scdb-codebook.json`). Pure; `decisions-run.ts`
 * does the I/O.
 *
 * A code the codebook does not list (SCDB carries a handful of retired court codes) becomes null and is reported; more than
 * `MAX_UNKNOWN` of them means the codebook is out of date and fails the build.
 */
export const MAX_UNKNOWN = 25;

/** CSV column -> the codebook list that labels it. */
const LABELLED = {
  issue: "issue",
  petitioner: "petitioner",
  petitionerState: "petitionerState",
  respondent: "petitioner",
  respondentState: "petitionerState",
  jurisdiction: "jurisdiction",
  caseOrigin: "caseSource",
  caseOriginState: "petitionerState",
  caseSource: "caseSource",
  caseSourceState: "petitionerState",
  certReason: "certReason",
  lcDisposition: "lcDisposition",
  caseDisposition: "caseDisposition",
  declarationUncon: "declarationUncon",
  lawType: "lawType",
  lawSupp: "lawSupp",
  authorityDecision1: "authorityDecision1",
  authorityDecision2: "authorityDecision1",
} as const satisfies Record<string, keyof ScdbCodebook["vars"]>;

/** "10/4/2021" -> "2021-10-04"; blank -> null. */
export function isoOrNull(us: string | undefined): string | null {
  const s = (us ?? "").trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) throw new DecisionsDataError(`unparseable date "${us}"`);
  return `${m[3]}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}

/** SCDB's Latin-1 file carries a few UTF-8 sequences read as Latin-1 ("Â§" for "§"): undo that where it round-trips cleanly. */
export function fixMojibake(s: string): string {
  if (!/[ÂÃâ]/.test(s)) return s;
  const back = Buffer.from(s, "latin1").toString("utf8");
  return back.includes("\uFFFD") ? s : back;
}

/** The codebook appends notes to some issue labels ("... Note: those challenged on ..."): the label is the part before. */
const dropNote = (s: string): string => s.replace(/\s+Note:[\s\S]*$/, "").trim();

const num = (s: string | undefined): number | null => {
  const t = (s ?? "").trim();
  return t === "" ? null : Number(t);
};

export interface DetailsReport {
  cases: number;
  unknown_codes: Record<string, Record<string, number>>;
  argued: number;
  reargued: number;
  precedent_altered: number;
  declared_unconstitutional: number;
}

/** One row per selected case, in `caseIds` order. */
export function buildCaseDetails(csvText: string, caseIds: readonly string[], codebook: ScdbCodebook): { rows: DecisionDetailRow[]; report: DetailsReport } {
  const raw = parseCsv(csvText, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
  const byId = new Map(raw.map((r) => [r.caseId!, r]));
  const unknown: Record<string, Record<string, number>> = {};

  const label = (row: Record<string, string>, col: keyof typeof LABELLED): string | null => {
    const code = (row[col] ?? "").trim();
    if (!code) return null;
    const hit = codebook.vars[LABELLED[col]][code];
    if (hit === undefined) {
      (unknown[col] ??= {})[code] = (unknown[col]![code] ?? 0) + 1;
      return null;
    }
    return hit;
  };

  const rows = caseIds.map((id): DecisionDetailRow => {
    const r = byId.get(id);
    if (!r) throw new DecisionsDataError(`case ${id} is not in the SCDB file`);
    const won = num(r.partyWinning);
    const uncon = num(r.declarationUncon);
    // SCDB writes "NA" where it has no statute name.
    const lawMinor = fixMojibake((r.lawMinor ?? "").trim()).replace(/^N\/?A$/i, "");
    const docket = (r.docket ?? "").trim();
    return {
      case_id: id,
      docket: docket || null,
      argued: isoOrNull(r.dateArgument),
      reargued: isoOrNull(r.dateRearg),
      petitioner: label(r, "petitioner"),
      petitioner_state: label(r, "petitionerState"),
      respondent: label(r, "respondent"),
      respondent_state: label(r, "respondentState"),
      jurisdiction: label(r, "jurisdiction"),
      origin: label(r, "caseOrigin"),
      origin_state: label(r, "caseOriginState"),
      source: label(r, "caseSource"),
      source_state: label(r, "caseSourceState"),
      lc_disposition: label(r, "lcDisposition"),
      lc_dissent: num(r.lcDisagreement) === 1,
      cert_reason: label(r, "certReason"),
      disposition: label(r, "caseDisposition"),
      disposition_unusual: num(r.caseDispositionUnusual) === 1,
      petitioner_won: won === 1 ? true : won === 0 ? false : null,
      precedent_altered: num(r.precedentAlteration) === 1,
      unconstitutional: uncon !== null && uncon > 1 ? label(r, "declarationUncon") : null,
      issue: (() => {
        const l = label(r, "issue");
        return l === null ? null : dropNote(l);
      })(),
      law_type: label(r, "lawType"),
      law: label(r, "lawSupp"),
      law_minor: lawMinor || null,
      authority: [label(r, "authorityDecision1"), label(r, "authorityDecision2")].filter((a): a is string => a !== null),
      maj_writer: num(r.majOpinWriter),
      maj_assigner: num(r.majOpinAssigner),
    };
  });

  const unknownTotal = Object.values(unknown).reduce((s, m) => s + Object.values(m).reduce((a, b) => a + b, 0), 0);
  if (unknownTotal > MAX_UNKNOWN) throw new DecisionsDataError(`${unknownTotal} codes are missing from pipeline/reference/scdb-codebook.json (${JSON.stringify(unknown)}); re-run pnpm fetch:scdb-codebook`);
  return {
    rows,
    report: {
      cases: rows.length,
      unknown_codes: unknown,
      argued: rows.filter((r) => r.argued !== null).length,
      reargued: rows.filter((r) => r.reargued !== null).length,
      precedent_altered: rows.filter((r) => r.precedent_altered).length,
      declared_unconstitutional: rows.filter((r) => r.unconstitutional !== null).length,
    },
  };
}

/**
 * The opening of each case's Wikipedia article, as paragraphs, for the cases whose article is about the case: those with a
 * summary sentence, and those whose opening names a U.S. Reports cite or the Supreme Court (a redirect can land on a volume list
 * or on an article about one of the parties). Every lead ends on a finished sentence; footnote marks come out.
 */
const LIST_LEAD = /^(?:This is a|The following is a|List of)\b/;
const ABOUT_A_CASE = /\d+\s+U\.\s?S\.\s+(?:\d+|_+)|Supreme Court/;

/** A finished sentence: ends on a full stop, question or exclamation mark, before any closing quote or bracket. */
const ENDS_SENTENCE = /[.!?]["”’')\]]*$/;
/** Wikipedia footnote marks ("[1]", "[note 2]") left in the plain-text extract. */
const FOOTNOTE = /\[(?:\d+|note \d+|[a-z])\]/g;

export function buildCaseLeads(cases: readonly { case_id: string; title: string; summary: boolean }[], leads: Record<string, string>): CaseLeadRow[] {
  const out: CaseLeadRow[] = [];
  for (const c of cases) {
    const text = leads[c.title]?.trim();
    if (!text) continue;
    if (!c.summary && (LIST_LEAD.test(text) || !ABOUT_A_CASE.test(text.slice(0, 300)))) continue;
    const paragraphs = text
      .split(/\n+/)
      .map((p) => p.replace(FOOTNOTE, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    // The fetch keeps a capped stretch of the lead, so the last paragraph can stop mid-sentence ("Dobbs led to profound
    // cultural"): drop the unfinished tail, and the paragraph with it if nothing finished is left.
    while (paragraphs.length > 0 && !ENDS_SENTENCE.test(paragraphs[paragraphs.length - 1]!)) {
      const sentences = splitSentences(paragraphs.pop()!);
      while (sentences.length > 0 && !ENDS_SENTENCE.test(sentences[sentences.length - 1]!)) sentences.pop();
      if (sentences.length > 0) paragraphs.push(sentences.join(" "));
    }
    if (paragraphs.length > 0) out.push({ case_id: c.case_id, title: c.title, paragraphs });
  }
  return out;
}
