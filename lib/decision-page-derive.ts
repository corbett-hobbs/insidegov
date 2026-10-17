import type { DecisionDetailRow } from "./decisions-entities";
import type { DecisionParty, TimelineStep } from "./decision-page-types";

/**
 * Pure shaping for the decision pages (`lib/decision-page-data.ts` does the I/O): the codebook's labels made readable, the
 * parties split out of the case name, the case's path to the Court as timeline steps, and links to the opinion elsewhere.
 */

const sentenceCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * The codebook's wording, trimmed for a page: a trailing note or "cf." cross-reference ("employer. If employer's relations ...") and long or "includes"
 * parentheticals come off, as does a dangling tail ("employee, or job applicant, including beneficiaries of"). Sentence-cased.
 */
export function codebookLabel(raw: string): string {
  let s = raw.trim();
  // A note after the label: a full stop that does not follow an initial ("U.S. Court") and opens a new sentence.
  s = s.replace(/(?<!\b[A-Z])\.\s+[A-Z][a-z][\s\S]*$/, "");
  // A cross-reference ("(cf. comity: First Amendment)", ". cf. state regulation of business") is the codebook talking to coders.
  s = s.replace(/[.,;]?\s*\(?\bcf\.[\s\S]*$/, "");
  s = s.replace(/\s*\((?:includes?\b[^)]*|[^)]{31,})\)/g, "");
  s = s.replace(/,\s*including\b[^,]*$/, "");
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/[,;:]?\s+(?:of|or|and|for|to|the)$/i, "").replace(/[,;:.\s]+$/, "");
  }
  return sentenceCase(s);
}

const GENERIC_STATE = /^State\s+(.+)$/;

/** "State Supreme Court" + "Missouri" -> "Missouri Supreme Court"; a court that names its own place is left alone. */
export function courtName(label: string | null, state: string | null): string | null {
  if (label === null) return null;
  const l = codebookLabel(label);
  const m = GENERIC_STATE.exec(l);
  if (m && state) return `${state} ${m[1]!.toLowerCase().replace(/\bsupreme court\b/, "Supreme Court")}`;
  return l;
}

/**
 * The two sides from the case name ("Wooden v. United States" -> "Wooden", "United States"), each with SCDB's category for it.
 * "In re Gault" and other one-party captions have no respondent name.
 */
export function splitParties(caseName: string, d: Pick<DecisionDetailRow, "petitioner" | "petitioner_state" | "respondent" | "respondent_state">): { petitioner: DecisionParty; respondent: DecisionParty } {
  const at = caseName.search(/\s+v\.?\s+/);
  const [pet, res] = at < 0 ? [null, null] : [caseName.slice(0, at).trim(), caseName.slice(at).replace(/^\s+v\.?\s+/, "").trim()];
  const kind = (label: string | null, state: string | null) => (label === null || /^unidentifiable$/i.test(label) ? null : state && !/united states/i.test(label) ? `${codebookLabel(label)} (${state})` : codebookLabel(label));
  return {
    petitioner: { name: pet || null, kind: kind(d.petitioner, d.petitioner_state) },
    respondent: { name: res || null, kind: kind(d.respondent, d.respondent_state) },
  };
}

const STRUCK: Record<string, string> = {
  "act of congress declared unconstitutional": "An act of Congress",
  "state or territorial law, reg, or const provision unconstitutional": "A state law",
  "municipal or other local ordinance unconstitutional": "A local ordinance",
};
export const struckDownText = (label: string | null): string | null => (label === null ? null : (STRUCK[label] ?? codebookLabel(label)));

const JURISDICTION: Record<string, string> = {
  cert: "Certiorari (the Court chose to hear it)",
  appeal: "Appeal (the Court was required to hear it)",
  original: "Original jurisdiction (filed directly in the Supreme Court)",
  certification: "Certification (a lower court asked the Court a question)",
};
export const jurisdictionText = (label: string | null): string | null => (label === null ? null : (JURISDICTION[label] ?? codebookLabel(label)));

/**
 * Why the Court took the case, in plain words, only where the reason says something: lower courts disagreeing or unsure.
 * "To resolve question presented", "important question", "other reason" and "no reason given" are true of any case, so null.
 */
const CERT_REASON: Record<string, string> = {
  "federal court conflict": "Federal appeals courts had ruled differently on the question",
  "federal court conflict and to resolve important or significant question": "Federal appeals courts had ruled differently, and the question was important",
  "putative conflict": "Lower courts appeared to disagree",
  "conflict between federal court and state court": "A federal court and a state court had ruled differently",
  "state court conflict": "State courts had ruled differently",
  "federal court confusion or uncertainty": "Federal courts were unsure how to apply the law",
  "state court confusion or uncertainty": "State courts were unsure how to apply the law",
  "federal court and state court confusion or uncertainty": "Federal and state courts were unsure how to apply the law",
};
export const certReasonText = (label: string | null): string | null => (label === null ? null : (CERT_REASON[label] ?? null));

/** "affirmed (includes modified)" -> "Affirmed"; the parenthetical "(or vacated)" stays, it changes the meaning. */
export const dispositionText = (label: string | null): string | null => (label === null ? null : codebookLabel(label));

/** Provisions too broad to name on their own ("Infrequently litigated statutes", "No Legal Provision"). */
export const GENERIC_LAW = new Set(["Infrequently litigated statutes", "State or Local Law Regulation", "No Legal Provision", "Other"]);

/** What the case was about in law: SCDB's coded provision, else its free-text statute name. */
export function provisionText(d: Pick<DecisionDetailRow, "law" | "law_minor">): string | null {
  if (d.law && !GENERIC_LAW.has(d.law)) return d.law;
  return d.law_minor;
}

/** The court the Supreme Court reviewed, as a phrase for a sentence ("the U.S. Court of Appeals, Fifth Circuit"). */
const theCourt = (court: string | null): string => (court ? `the ${court}` : "the lower court");

/**
 * What the Court's disposition means for this case, in plain words, naming the court it reviewed. Keyed on the codebook's
 * own wording (`caseDisposition`); an equally divided Court gets its own sentence whatever the code says.
 */
export function dispositionMeaning(label: string | null, courtBelow: string | null, divided: boolean): string | null {
  const below = theCourt(courtBelow);
  const decision = `the decision of ${below}`;
  if (divided) return `Affirmed by an equally divided Court: with the justices split evenly, ${decision} stands, but the Court wrote no opinion and the ruling sets no precedent for other cases.`;
  switch (label) {
    case "affirmed (includes modified)":
      return `Affirmed: the Supreme Court upheld ${decision}, so it stands (sometimes with changes the Court made to it).`;
    case "reversed":
      return `Reversed: the Supreme Court overturned ${decision}, and its own ruling ends the case.`;
    case "reversed and remanded":
      return `Reversed and remanded: the Supreme Court overturned ${decision} and sent the case back to that court for further proceedings that follow the Supreme Court’s ruling.`;
    case "vacated and remanded":
      return `Vacated and remanded: the Supreme Court set aside ${decision}, wiping it out without necessarily saying the result was wrong, and sent the case back for that court to decide again under the right legal standard.`;
    case "vacated":
      return `Vacated: the Supreme Court set aside ${decision}, so it no longer has any effect.`;
    case "affirmed and reversed (or vacated) in part":
      return `Affirmed in part and reversed in part: the Supreme Court upheld part of ${decision} and overturned or set aside the rest.`;
    case "affirmed and reversed (or vacated) in part and remanded":
      return `Affirmed in part, reversed in part and remanded: the Supreme Court upheld part of ${decision}, overturned or set aside the rest, and sent the case back for further proceedings that follow its ruling.`;
    case "petition denied or appeal dismissed":
      return `Dismissed: after hearing the case the Supreme Court declined to decide it, so ${decision} stands.`;
    case "stay, petition, or motion granted":
      return "Granted: the Supreme Court gave the party what it asked for, such as a stay or an order.";
    case "certification to or from a lower court":
      return "Certified question: the Supreme Court answered a legal question a lower court had sent it, and the lower court decides the case with that answer.";
    default:
      return null;
  }
}

/**
 * The case's path to the Court, newest first like every dated list (ARCHITECTURE_MAP rule 15a): the decision, reargument,
 * argument, how it got to the Court, then the court the Supreme Court reviewed and the court it began in (the last three are
 * not dated in the record, and all came before the argument).
 */
export function buildTimeline(
  d: DecisionDetailRow,
  decided: { date: string; maj: number; min: number; disposition: string | null; petitionerWon: boolean | null; petitioner: string | null },
): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const origin = courtName(d.origin, d.origin_state);
  const source = courtName(d.source, d.source_state);
  if (origin && origin !== source) steps.push({ date: null, kind: "Began", text: `The case began in the ${origin}.` });
  if (source) {
    const what = d.lc_disposition ? `: ${d.lc_disposition}${d.lc_dissent ? ", with a dissent" : ""}` : d.lc_dissent ? ", with a dissent" : "";
    steps.push({ date: null, kind: "Court below", text: `${origin === source ? "Began in and was decided by" : "Decided by"} the ${source}${what}.` });
  }
  const juris = d.jurisdiction;
  if (juris === "cert") {
    const why = certReasonText(d.cert_reason);
    steps.push({ date: null, kind: "Taken up", text: `The Supreme Court agreed to hear the case (certiorari)${why ? `. ${why}` : ""}.` });
  } else if (juris === "appeal") {
    steps.push({ date: null, kind: "Taken up", text: "Reached the Supreme Court on appeal, which the Court had to hear." });
  } else if (juris === "original") {
    steps.push({ date: null, kind: "Filed", text: "Filed directly in the Supreme Court, under its original jurisdiction." });
  } else if (juris) {
    steps.push({ date: null, kind: "Taken up", text: `Reached the Supreme Court by ${juris}.` });
  }
  if (d.argued) steps.push({ date: d.argued, kind: "Argued", text: "Oral argument before the Court." });
  if (d.reargued) steps.push({ date: d.reargued, kind: "Reargued", text: "The Court heard the case argued a second time." });
  const won = decided.petitionerWon === null ? "" : ` ${decided.petitioner ?? "The party that brought the case"} ${decided.petitionerWon ? "won" : "lost"}.`;
  steps.push({ date: decided.date, kind: "Decided", text: `Decided ${decided.maj}–${decided.min}${decided.disposition ? `: ${decided.disposition.charAt(0).toLowerCase()}${decided.disposition.slice(1)}` : ""}.${won}` });
  return steps.reverse();
}

/** Justia's page for a U.S. Reports cite ("595 U.S. 360"); null for a cite that is not one. */
export function justiaUrl(cite: string): string | null {
  const m = /^(\d+)\s+U\.\s?S\.\s+(\d+)$/.exec(cite.trim());
  return m ? `https://supreme.justia.com/cases/federal/us/${m[1]}/${m[2]}/` : null;
}

/**
 * Oyez files a case from the 1955 term on under its term and docket ("/cases/2021/20-5279"); earlier terms are grouped by era
 * and a docket with spaces or "Orig." is not on that path, so those get no link.
 */
export function oyezUrl(term: number, docket: string | null): string | null {
  if (term < 1955 || !docket || !/^[\w-]+$/.test(docket)) return null;
  return `https://www.oyez.org/cases/${term}/${docket}`;
}
