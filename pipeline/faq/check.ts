import { numberWord } from "../transform/eo-summaries";
import { splitSentences } from "../transform/wikipedia-case-summaries";
import { sourceNotAllowed } from "./sources";

/**
 * The checks every FAQ answer must pass before it is offered for approval, again before it is published, and again whenever
 * the page's data or the sources change (`recheck.ts`). A failing draft is retried with the reason, then dropped.
 *
 * - 2-4 sentences of plain prose that answer the question, not talk about the sources ("the report does not say");
 * - every number in the answer appears in a source it cites (as written, spelled out, or as the compact form of a larger
 *   figure there: "9.9 billion" or "9,900,000,000" for "$9.9B"), and numbers of 10,000 or more are compact (rule 2g);
 * - no causal claim about a policy (a cause word and a policy word in one sentence);
 * - none of the loaded adjectives sources and press releases use;
 * - no politicians or parties, unless the reviewed question list allows the name;
 * - every cited source on the allowed list.
 */

export const MIN_SENTENCES = 2;
export const MAX_SENTENCES = 4;
export const MAX_CHARS = 720;

export type CitedSource = { label: string; url: string; text: string };

/** An answer that talks about its sources instead of answering ("The sources don't rank...", "the report gives only..."). */
const META = /\b(?:the|these|this|its|my|cited) sources?\b|\b(?:report|page|document|text|data)\s+(?:does not|doesn['’]t|do not|don['’]t|gives only|only gives|shows only|only shows)\b/i;
/** "U.S." ending a sentence: the sentence splitter keeps it as an abbreviation, so mark the stop before the next sentence. */
const US_STOP = /\bU\.S\.(?= (?:A|An|The|It|Its|This|These|They|In|On|Most|Some|Each|If|Both|Only|For|Under|When|Permanent|People)\b)/g;

const CAUSE = /\b(because|due to|caused|causes|causing|led to|leads to|leading to|resulted in|results in|as a result|thanks to|driven by|drove|blamed|responsible for|fueled|spurred|triggered|in response to|so that)\b/i;
const POLICY = /\b(polic(?:y|ies)|tariffs?|laws?|acts?|legislation|executive orders?|regulations?|rules?|administrations?|president(?:'s|ial)?|congress|ban|crackdown|enforcement|sanctions?|tax cuts?|stimulus|shutdown|proclamations?|deportations?)\b/i;

/** Loaded words a source, a press release or a news story might use and a neutral answer must not carry over. */
export const LOADED = [
  "radical", "extreme", "historic", "unprecedented", "illegal alien", "illegals", "invasion", "flood", "flooding", "surge", "surging", "crisis", "chaos", "chaotic",
  "devastating", "disastrous", "catastrophic", "skyrocket", "skyrocketing", "soaring", "soared", "plummet", "plummeting", "plunged", "staggering", "alarming",
  "massive", "huge", "dramatic", "dramatically", "wasteful", "reckless", "common-sense", "commonsense", "failed", "failing", "disaster", "booming", "tremendous",
  "record-breaking", "out of control", "open border", "open borders", "amnesty", "draconian", "cruel", "brutal", "heartbreaking", "shocking", "slashed", "gutted",
];
const LOADED_RE = new RegExp(`\\b(${LOADED.map((w) => w.replace(/[-\s]/g, "[-\\s]")).join("|")})\\b`, "i");

const PARTY = /\b(democrats?|democratic party|republicans?|republican party|gop|maga|liberals?|conservatives?|progressives?|left-wing|right-wing|far-left|far-right)\b/i;
/** Presidents since 1929 and vice presidents since 1993, by surname. */
const POLITICIANS = ["Hoover", "Roosevelt", "Truman", "Eisenhower", "Kennedy", "Nixon", "Ford", "Carter", "Reagan", "Bush", "Clinton", "Obama", "Trump", "Biden", "Harris", "Vance", "Pence", "Cheney", "Gore"];
const POLITICIAN_RE = new RegExp(`\\b(${POLITICIANS.join("|")})\\b`);
const NAMED_ADMIN = /\b[A-Z][a-z]+(?:-[A-Z][a-z]+)? administration\b/;

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9, t: 1e12, trillion: 1e12 };

/** A number as written: its value, the decimals it was given to, and the scale word or letter after it. */
type Num = { raw: string; value: number; decimals: number; scale: number };

const NUM_RE = /(?<![\w.])\d[\d,]*(?:\.\d+)?(?:\s?(?:K|M|B|T)\b|\s(?:thousand|million|billion|trillion)\b)?/g;

export function numbersIn(text: string): Num[] {
  const out: Num[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const raw = m[0].trim();
    const [, digits = "", word = ""] = raw.match(/^([\d,]*\d(?:\.\d+)?)\s?(.*)$/) ?? [];
    // "1,234" is one number; "2019," in a list is a number and a comma.
    const clean = digits.replace(/,(?=\d{3}\b)/g, "");
    if (!/^\d+(\.\d+)?$/.test(clean)) continue;
    out.push({ raw, value: Number(clean), decimals: clean.split(".")[1]?.length ?? 0, scale: SCALE[word.toLowerCase()] ?? 1 });
  }
  return out;
}

/** True when `n`, as the answer writes it, is in the source: the same value, spelled out, or a figure that rounds to it. */
export function numberInSource(n: Num, sourceNums: readonly Num[], sourceText: string): boolean {
  const target = n.value * n.scale;
  const word = n.scale === 1 ? numberWord(n.value) : null;
  if (word && new RegExp(`\\b${word}\\b`, "i").test(sourceText)) return true;
  const step = 10 ** -n.decimals * n.scale;
  return sourceNums.some((s) => {
    const v = s.value * s.scale;
    if (n.scale === 1) return Math.abs(v - target) < 1e-9 * Math.max(1, target) || (s.scale === 1 && Math.abs(s.value - n.value) < 1e-9);
    // A compact figure ("$9.9B", "348.9K") matches a source figure that rounds to it at the precision shown.
    return Math.abs(v - target) <= step / 2 + 1e-9 * target;
  });
}

/** Why an answer fails, or null when it passes. `cited` are the sources the answer cites, with their text read now. */
export function checkFaqAnswer(answer: string, cited: readonly CitedSource[], opts: { allowNames?: readonly string[] } = {}): string | null {
  if (/[\n\r]/.test(answer) || /[*#_`[\]<>]/.test(answer)) return "the answer must be plain prose: no line breaks, lists, links or markdown";
  if (!/[.!?]["”)]?$/.test(answer)) return "the answer must end with a full stop";
  if (answer.length > MAX_CHARS) return `the answer is ${answer.length} characters; keep it under ${MAX_CHARS}`;
  if (META.test(answer)) return "answer the question itself; do not talk about the sources or what they leave out";
  const sentences = splitSentences(answer.replace(US_STOP, "US."));
  if (sentences.length < MIN_SENTENCES || sentences.length > MAX_SENTENCES) return `the answer has ${sentences.length} sentences; it must have ${MIN_SENTENCES} to ${MAX_SENTENCES}`;

  const loaded = answer.match(LOADED_RE);
  if (loaded) return `"${loaded[0]}" is a loaded word; describe it in plain, neutral terms`;
  const allowed = new Set(opts.allowNames ?? []);
  const party = answer.match(PARTY);
  if (party && !allowed.has(party[0])) return `"${party[0]}": leave parties and political labels out`;
  const person = answer.match(POLITICIAN_RE) ?? answer.match(NAMED_ADMIN);
  if (person && !allowed.has(person[0])) return `"${person[0]}": name the office ("the President"), not the politician`;
  for (const s of sentences) {
    const cause = s.match(CAUSE);
    const policy = s.match(POLICY);
    if (cause && policy) return `"${s}" reads as a causal claim about policy ("${cause[0]}" with "${policy[0]}"); say what the rule or law does, not what it caused`;
  }

  if (cited.length === 0) return "the answer cites no source";
  for (const c of cited) {
    const why = sourceNotAllowed(c.url);
    if (why) return why;
  }
  const nums = numbersIn(answer);
  const big = nums.find((n) => n.scale === 1 && n.value >= 10_000);
  if (big) return `write ${big.raw} in compact form (e.g. 166.6K, 1.2M, $47.8B), as the site does for figures of 10,000 or more`;
  const sourceNums = cited.flatMap((c) => numbersIn(c.text));
  const sourceText = cited.map((c) => c.text).join("\n");
  const stray = nums.find((n) => !numberInSource(n, sourceNums, sourceText));
  if (stray) return `the number ${stray.raw} is not in the sources the answer cites; use only figures the sources give, as they give them`;
  return null;
}
