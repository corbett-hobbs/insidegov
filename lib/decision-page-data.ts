import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { shortCaseName } from "./case-name";
import { getDecisionCases, getDecisionsPageData } from "./decisions-data";
import { caseLeadRow, decisionDetailRow, type DecisionDetailRow, type JusticeVote } from "./decisions-entities";
import type { DecisionCase } from "./decisions-types";
import { buildTimeline, certReasonText, codebookLabel, courtName, dispositionMeaning, dispositionText, jurisdictionText, justiaUrl, oyezUrl, provisionText, splitParties, struckDownText } from "./decision-page-derive";
import type { BenchJustice, BenchRole, BenchVote, DecisionPageData, RelatedDecision } from "./decision-page-types";
import { caseScdbArea, caseTopic, wikiCaseUrl } from "./decisions-derive";
import { getCourtPayload, getJusticeProfile } from "./justice-data";
import { justicePath } from "./justice-url";
import { justiceVotesFile } from "./decisions-entities";
import { scoreAt } from "./court-types";
import { mqProvisional, type MqProvisional } from "./court-entities";

/**
 * Build-time reader for /supreme-court/decisions/<case_id>/<slug>: the case-list row (`getDecisionCases`), its SCDB details
 * (`decisions_details.json`), the opening of its Wikipedia article (`decisions_leads.json`) and how each justice voted
 * (`court/justice_votes.json`, inverted here from per-justice to per-case), joined once per build and served one case at a time.
 * Shaping is the pure `lib/decision-page-derive.ts`.
 */
const OUT = join(process.cwd(), "pipeline", "output");
const read = (file: string): unknown => JSON.parse(readFileSync(join(OUT, file), "utf8"));

interface Index {
  cases: Map<string, DecisionCase>;
  details: Map<string, DecisionDetailRow>;
  leads: Map<string, { title: string; paragraphs: string[] }>;
  /** case id -> [justice id, vote, role] in the order the justices file lists them. */
  bench: Map<string, [number, JusticeVote[1], JusticeVote[2]][]>;
  /** SCDB issue -> every case filed under it, newest first, as list rows. */
  related: Map<string, RelatedDecision[]>;
  /** Term -> every case argued and decided in it, newest first, as list rows. */
  byTerm: Map<number, RelatedDecision[]>;
}

let index: Index | null = null;
let provisionalCache: MqProvisional | null | undefined;

/** Hand-copied provisional scores for the term after the official release, or null when there are none. */
function provisional(): MqProvisional | null {
  if (provisionalCache === undefined) {
    try {
      provisionalCache = mqProvisional.parse(JSON.parse(readFileSync(join(process.cwd(), "pipeline", "reference", "mq-provisional.json"), "utf8")));
    } catch {
      provisionalCache = null;
    }
  }
  return provisionalCache;
}

function load(): Index {
  if (index) return index;
  const list = getDecisionCases();
  const cases = new Map(list.map((c) => [c[14], c]));
  const details = new Map(z.array(decisionDetailRow).parse(read("decisions_details.json")).map((r) => [r.case_id, r]));
  const leads = new Map(z.array(caseLeadRow).parse(read("decisions_leads.json")).map((r) => [r.case_id, { title: r.title, paragraphs: r.paragraphs }]));
  const bench = new Map<string, [number, JusticeVote[1], JusticeVote[2]][]>();
  for (const [jid, votes] of Object.entries(justiceVotesFile.parse(read("court/justice_votes.json")))) {
    for (const [caseId, vote, role] of votes) {
      let row = bench.get(caseId);
      if (!row) bench.set(caseId, (row = []));
      row.push([Number(jid), vote, role]);
    }
  }
  // The case list is newest first, so each issue's cases are too.
  const related = new Map<string, RelatedDecision[]>();
  const byTerm = new Map<number, RelatedDecision[]>();
  const { areas, scdbAreas } = getDecisionsPageData();
  for (const c of list) {
    const row = { c, area: caseTopic(areas, c), areaId: caseScdbArea(scdbAreas, c) };
    let terms = byTerm.get(c[0]);
    if (!terms) byTerm.set(c[0], (terms = []));
    terms.push(row);
    const issue = details.get(c[14])?.issue;
    if (!issue) continue;
    let arr = related.get(issue);
    if (!arr) related.set(issue, (arr = []));
    arr.push(row);
  }
  index = { cases, details, leads, bench, related, byTerm };
  return index;
}

/** The middle score (the mean of the two middle ones for an even count). */
const medianOf = (xs: number[]): number => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
};

export interface DecisionRef {
  caseId: string;
  name: string;
  term: number;
  landmark: boolean;
}

/** Every case with a page, newest first: for static params and the sitemap. */
export function getDecisionRefs(): DecisionRef[] {
  return getDecisionCases().map((c) => ({ caseId: c[14], name: c[2], term: c[0], landmark: c[8] !== "" }));
}

export function getDecisionRef(caseId: string): DecisionRef | null {
  const c = load().cases.get(caseId);
  return c ? { caseId: c[14], name: c[2], term: c[0], landmark: c[8] !== "" } : null;
}

export function getDecisionPage(caseId: string): DecisionPageData | null {
  const { cases, details, leads, bench, related, byTerm } = load();
  const c = cases.get(caseId);
  const d = details.get(caseId);
  if (!c || !d) return null;
  const payload = getDecisionsPageData();
  const court = getCourtPayload();
  const term = c[0];

  const chief = payload.chiefs.find((s) => term >= s.start && term <= s.end);
  const area = c[15] >= 0 ? payload.scdbAreas[c[15]]! : null;
  const topic = c[4] >= 0 ? payload.areas[c[4]]! : null;
  const parties = splitParties(c[2], d);
  const disposition = dispositionText(d.disposition);

  const byId = new Map(court.justices.map((j) => [j.id, j]));
  // Past the official release, the provisional report's scores stand in (never for a term the official data covers).
  const prov = provisional();
  const provScores = prov && prov.term === term && term > court.lastTerm ? new Map(prov.scores.map((r) => [r.justice_id, r.mq_score])) : null;
  const seats: BenchJustice[] = (bench.get(caseId) ?? []).flatMap(([id, vote, role]) => {
    const j = byId.get(id);
    const p = getJusticeProfile(id);
    if (!j || !p) return [];
    const score = provScores ? (provScores.get(id) ?? null) : term >= j.t0 && term <= j.t1 ? scoreAt(j, term) ?? null : null;
    return [{ id, name: j.name, short: j.short, party: j.party, appointedBy: p.identity.appointedBy.president, path: justicePath({ id, name: p.justice.name }), photoSrc: p.photoSrc, score, vote: vote as BenchVote, role: role as BenchRole }];
  });
  // Most liberal first, as the strip reads; a justice with no score that term goes last.
  seats.sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity) || a.id - b.id);
  const writer = d.maj_writer === null ? null : seats.find((s) => s.id === d.maj_writer) ?? null;
  const termRec = court.terms.find((t) => t.term === term);

  const termPeers = (byTerm.get(term) ?? []).filter((r) => r.c[14] !== caseId);
  const peers = d.issue ? (related.get(d.issue) ?? []).filter((r) => r.c[14] !== caseId) : [];
  const courtBelow = courtName(d.source, d.source_state);
  const provision = provisionText(d);
  const lead = leads.get(caseId) ?? null;
  const wiki = wikiCaseUrl(c);

  return {
    caseId,
    name: c[2],
    shortName: shortCaseName(c[2], typeof c[10] === "string" ? c[10] : c[8] || lead?.title || null),
    cite: c[3],
    docket: d.docket,
    term,
    decided: c[1],
    argued: d.argued,
    reargued: d.reargued,
    court: chief ? `${chief.last} Court` : `${term} term`,
    area: area ? { id: area.id, label: area.label } : null,
    topic: topic ? { id: topic.id, label: topic.label } : null,
    issue: d.issue ? codebookLabel(d.issue) : null,
    direction: c[13] === 0 ? null : c[13],
    landmark: c[8] ? { title: c[8], topics: c[9] } : null,
    vote: { maj: c[6], min: c[7], band: c[5] },
    disposition,
    dispositionNote: dispositionMeaning(d.disposition, courtBelow, c[6] === c[7]),
    petitionerWon: d.petitioner_won,
    precedentAltered: d.precedent_altered,
    struckDown: struckDownText(d.unconstitutional),
    writer: writer ? { id: writer.id, name: writer.name, path: writer.path } : null,
    petitioner: parties.petitioner,
    respondent: parties.respondent,
    jurisdiction: jurisdictionText(d.jurisdiction),
    certReason: certReasonText(d.cert_reason),
    law: { type: d.law_type && d.law_type !== "No Legal Provision" ? d.law_type : null, provision, authority: d.authority.map(codebookLabel) },
    bench: seats,
    median: provScores ? medianOf([...provScores.values()]) : termRec?.median ?? null,
    scoresProvisional: provScores && prov ? { source: prov.source, url: prov.url, published: prov.published } : null,
    domain: court.domain,
    summary: lead,
    sentence: c[11] ? { text: c[11], claude: c[12] === 1 } : null,
    timeline: buildTimeline(d, { date: c[1], maj: c[6], min: c[7], disposition, petitionerWon: d.petitioner_won, petitioner: parties.petitioner.name }),
    related: d.issue && peers.length > 0 ? { issue: codebookLabel(d.issue), cases: peers } : null,
    sameTerm: termPeers.length > 0 ? { term, cases: termPeers } : null,
    links: { wikipedia: wiki, oyez: oyezUrl(term, d.docket), justia: justiaUrl(c[3]) },
    scdbVersion: payload.versionLabel,
    dataThroughTerm: payload.terms[payload.terms.length - 1]!,
  };
}
