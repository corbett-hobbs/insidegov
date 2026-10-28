import { localDate } from "../schedule";
import type { Headline } from "../types";
import { countriesIn, type Partner } from "./match";
import { type OutletLean, OUTLETS, type Outlet, outletById, sideOf } from "./outlets";
import type { PageTopic } from "./topics";

/**
 * Headlines to the page-level "In the news" cards, pure (tested in news.test.ts). The steps, in order:
 *
 *   1. Topic: each outlet headline goes to the first page topic its title matches (topics.ts PAGE_TOPICS), with its
 *      trade partner for tariffs, so a story is about one chart on one page.
 *   2. Grouping: headlines on one topic within STORY_WINDOW_DAYS of the first are one candidate story, joined by other
 *      outlets' headlines on it that lack the topic's keywords but share its detail words (addCompanions). The Claude check
 *      (classify.ts checkCandidate) then keeps the ones that are straight news of the same single development; without
 *      it, topics that are not `periodic` keep only headlines that share a detail word with another outlet's.
 *   3. Outlets: a card needs at least MIN_OUTLETS outlets and shows at most three headlines: the agency's own data
 *      release, then one outlet per side, left, right, center, any outlet filling a side nobody ran (pickHeadlines).
 *   4. The file: earlier cards are kept until STORY_TTL_DAYS old, newest first, at most MAX_STORIES, at most
 *      MAX_PER_CHART per chart (mergeStories). Feeds carry a day or two, so the file is the memory.
 */

/** Headlines on one topic this close to the story's first are the same story. */
export const STORY_WINDOW_DAYS = 3;
/** A card stays on the page this long after its date. */
export const STORY_TTL_DAYS = 14;
/** Most cards a page shows (the row scrolls; three fill it on a desktop). */
export const MAX_STORIES = 6;
/** Most cards for one chart, so one busy topic does not fill the row. */
export const MAX_PER_CHART = 2;
/** Stories and their dates are days in this zone (U.S. news runs on Eastern time). */
export const NEWS_TIME_ZONE = "America/New_York";

export type CardLean = OutletLean | "Data";
/** The shape of lib/news-types.ts (the UI's zod schema): keep the field names in step. */
export type CardHeadline = { outletId: string; outlet: string; lean: CardLean; title: string; url: string };
export type PageStory = { id: string; date: string; topic: string; chartId?: string; groupId?: string; headlines: CardHeadline[] };
export type PageNewsFile = { asOf: string; stories: PageStory[] };

export type Candidate = {
  topic: PageTopic;
  /** "inflation", "tariff.CAN", "tariff.all". */
  key: string;
  country?: { code: string; name: string };
  /** Outlet headlines, oldest first. */
  headlines: Headline[];
};

const DAY = 86_400_000;
const day = (iso: string) => localDate(iso, NEWS_TIME_ZONE);

/** The headline's outlet gives no opinion signal (outlets.ts): it counts only when the Claude check calls it news. */
export const needsCheck = (h: Headline) => Boolean(h.outletId && outletById.get(h.outletId)?.needsCheck);

/** The topic (and key) a headline belongs to: the first that matches, or none. */
export function topicOf(title: string, topics: PageTopic[], partners: Partner[]): Omit<Candidate, "headlines"> | null {
  const topic = topics.find((t) => t.priority?.test(title) && !t.exclude?.test(title)) ?? topics.find((t) => t.match.test(title) && !t.exclude?.test(title));
  if (!topic) return null;
  if (topic.param !== "country") return { topic, key: topic.id };
  const named = countriesIn(title, partners);
  const country = named.length === 1 ? { code: named[0]!.code, name: named[0]!.name } : undefined;
  return { topic, key: `${topic.id}.${country?.code ?? "all"}`, country };
}

/**
 * Candidate stories in the outlet headlines at `now`: per topic key, headlines from the last STORY_TTL_DAYS cut into
 * runs of STORY_WINDOW_DAYS from each run's first headline. `usable` drops headlines first (opinion the check found,
 * outlets that need the check and did not get it).
 */
export function groupCandidates(headlines: Headline[], topics: PageTopic[], partners: Partner[], now: string, usable: (h: Headline) => boolean = () => true): Candidate[] {
  const t = Date.parse(now);
  const byKey = new Map<string, Candidate>();
  for (const h of headlines) {
    const age = t - Date.parse(h.published);
    if (age > STORY_TTL_DAYS * DAY || age < -3_600_000 || !h.outletId || !outletById.has(h.outletId) || !usable(h)) continue;
    const m = topicOf(h.title, topics, partners);
    if (!m) continue;
    const c = byKey.get(m.key) ?? byKey.set(m.key, { ...m, headlines: [] }).get(m.key)!;
    c.headlines.push(h);
  }
  const out: Candidate[] = [];
  for (const c of byKey.values()) {
    const sorted = [...c.headlines].sort((a, b) => a.published.localeCompare(b.published));
    let run: Headline[] = [];
    for (const h of sorted) {
      if (run.length && Date.parse(h.published) - Date.parse(run[0]!.published) > STORY_WINDOW_DAYS * DAY) {
        out.push({ ...c, headlines: run });
        run = [];
      }
      run.push(h);
    }
    if (run.length) out.push({ ...c, headlines: run });
  }
  return out;
}

const STOP = new Set(
  ("a an and are as at be by for from has have he her his how in is it its new of on or over says said she than that the their them they this to up us u.s. was were what when who why will with after amid about into more most not no out than just could would may might again after before under still now".split(" ")),
);

const RULING_WORDS = new Set(["supreme", "court", "justices", "justice", "ruling", "rules", "ruled", "rule", "decision", "decides", "decided", "high"]);

/** A title's detail words: lowercase, no stop words, no words of the topic's own pattern, no short words. */
export function detailWords(title: string, topic: PageTopic): Set<string> {
  const words = title.toLowerCase().replace(/[’']s\b/g, "").match(/[a-z0-9][a-z0-9.-]*[a-z0-9]|[a-z0-9]/g) ?? [];
  // A Decisions story's headlines all say "Supreme Court rules": those words do not make two rulings one story.
  return new Set(words.filter((w) => w.length > 3 && !STOP.has(w) && !(topic.page === "decisions" && RULING_WORDS.has(w)) && !topic.match.test(w) && !/^\d+$/.test(w)).map((w) => w.replace(/(ies|es|s)$/, "")));
}

/** Detail words two headlines need in common to be the same development, without the Claude check. */
export const MIN_SHARED_WORDS = 2;

/**
 * Without the Claude check, the same development is told by shared detail words ("Supreme Court", "Canada lumber"): a
 * headline stays if it shares MIN_SHARED_WORDS with a headline from another outlet. `periodic` topics (a weekly price, a
 * monthly report) are one development per window, so they keep every headline.
 */
export function sameDevelopment(c: Candidate): Headline[] {
  if (c.topic.periodic) return c.headlines;
  const words = c.headlines.map((h) => detailWords(h.title, c.topic));
  const shared = (i: number, j: number) => [...words[i]!].filter((w) => words[j]!.has(w)).length;
  return c.headlines.filter((h, i) => c.headlines.some((o, j) => j !== i && o.outletId !== h.outletId && shared(i, j) >= MIN_SHARED_WORDS));
}

/** Detail words a headline without the topic's keywords needs in common with a candidate's to join it. */
export const MIN_COMPANION_WORDS = 3;

/**
 * Outlets word the same story differently (that is the point of the cards): "Supreme Court declines to halt DOJ deal
 * ending Biden-era immigration rule" is the deportation story without the word. A headline that matched no chart's topic (a chartless topic's match does not count) joins a
 * candidate when it shares MIN_COMPANION_WORDS detail words with one of its headlines and falls in its window; the
 * check (or sameDevelopment) still has the last word.
 */
export function addCompanions(candidates: Candidate[], headlines: Headline[], topics: PageTopic[], partners: Partner[], now: string): Candidate[] {
  const t = Date.parse(now);
  const loose = headlines.filter((h) => h.outletId && outletById.has(h.outletId) && t - Date.parse(h.published) <= STORY_TTL_DAYS * DAY && !topicOf(h.title, topics.filter((t) => t.chartId), partners));
  return candidates.map((c) => {
    const first = Date.parse(c.headlines[0]!.published);
    const words = c.headlines.map((h) => detailWords(h.title, c.topic));
    const extra = loose.filter((h) => {
      const at = Date.parse(h.published);
      if (at < first - DAY || at > first + STORY_WINDOW_DAYS * DAY) return false;
      const own = detailWords(h.title, c.topic);
      return words.some((w) => [...own].filter((x) => w.has(x)).length >= MIN_COMPANION_WORDS);
    });
    return extra.length ? { ...c, headlines: [...c.headlines, ...extra].sort((a, b) => a.published.localeCompare(b.published)) } : c;
  });
}

/** A title as wire copy repeats it: lowercase letters and digits only. */
const sameTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * The outlet a card shows for one side: of the outlets on that side, the one with the most headlines on the story (it
 * covered it most), then the earliest in the roster (outlets.ts order is coverage strength); reserves only when no
 * roster outlet on that side has one. Its earliest headline on the story. Headlines with a title in `avoid` are skipped:
 * two outlets running the same wire story word for word show nothing about framing.
 */
function bestOf(headlines: Headline[], outlets: Outlet[], avoid: Set<string> = new Set()): Headline | undefined {
  const order = new Map(outlets.map((o, i) => [o.id, i]));
  const own = headlines.filter((h) => !avoid.has(sameTitle(h.title)));
  const pool = own.filter((h) => !outletById.get(h.outletId!)!.reserve);
  const use = pool.length ? pool : own;
  const counts = new Map<string, number>();
  for (const h of use) counts.set(h.outletId!, (counts.get(h.outletId!) ?? 0) + 1);
  const id = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || (order.get(a) ?? 99) - (order.get(b) ?? 99))[0];
  return id ? use.filter((h) => h.outletId === id).sort((a, b) => a.published.localeCompare(b.published))[0] : undefined;
}

/** The UI's lean order (lib/news-types.ts LEANS): the data release first, then left to right. */
export const LEAN_ORDER = ["Data", "Left", "Lean Left", "Center", "Lean Right", "Right"] as const satisfies readonly CardLean[];

function card(h: Headline, lean: CardLean): CardHeadline {
  return { outletId: h.outletId!, outlet: h.source, lean, title: h.title, url: h.url };
}

/** A card needs at least this many outlets; the data release does not count, it is the facts, not a framing. */
export const MIN_OUTLETS = 2;

/**
 * The card's headlines, or null when fewer than MIN_OUTLETS outlets ran the story. At most three: the agency's data
 * release (else one more outlet) and the best outlet on each side, left, right, then center, so a story both sides ran
 * shows both. When a side is missing (two stories no right-of-center outlet carried), other outlets fill the places,
 * one headline per outlet. Shown in the UI's order (Data, then left to right).
 */
export function pickHeadlines(headlines: Headline[], release?: Headline, outlets: Outlet[] = OUTLETS): CardHeadline[] | null {
  const lean = (h: Headline) => outletById.get(h.outletId!)!.lean;
  const room = release ? 2 : 3;
  const picked: Headline[] = [];
  const taken = new Set<string>();
  const add = (h: Headline | undefined) => {
    if (!h) return;
    picked.push(h);
    taken.add(sameTitle(h.title));
  };
  const unused = () => headlines.filter((h) => !picked.some((p) => p.outletId === h.outletId));
  // One outlet per side first, then anyone, so the places are filled in order of how different the framings are.
  for (const side of ["left", "right", "center"]) if (picked.length < room) add(bestOf(unused().filter((h) => sideOf(lean(h)) === side), outlets, taken));
  while (picked.length < room && unused().some((h) => !taken.has(sameTitle(h.title)))) add(bestOf(unused(), outlets, taken));
  if (picked.length < MIN_OUTLETS) return null;
  const out = [...(release ? [card(release, "Data")] : []), ...picked.map((h) => card(h, lean(h)))];
  return out.sort((a, b) => LEAN_ORDER.indexOf(a.lean) - LEAN_ORDER.indexOf(b.lean));
}

/**
 * The agency's own release that goes with a story: from the topic's release source, a title the topic's release pattern
 * matches, published from two days before the story's first headline to `lagDays` (default 2) after its last. The
 * closest to the first headline.
 */
export function releaseFor(c: Candidate, releases: Headline[]): Headline | undefined {
  const r = c.topic.release;
  if (!r) return undefined;
  const first = Date.parse(c.headlines[0]!.published);
  const last = Date.parse(c.headlines.at(-1)!.published);
  return releases
    .filter((h) => h.outletId === r.source && r.match.test(h.title))
    .filter((h) => {
      const t = Date.parse(h.published);
      return t >= first - 2 * DAY && t <= last + (r.lagDays ?? 2) * DAY;
    })
    .sort((a, b) => Math.abs(Date.parse(a.published) - first) - Math.abs(Date.parse(b.published) - first))[0];
}

/**
 * A card for a candidate, or null when fewer than MIN_OUTLETS outlets ran it. Its id is the key and the story's first day.
 * A chartless topic's story takes the chart the Claude check picked (`pickedChart`), if any.
 */
export function storyFor(c: Candidate, headlines: Headline[], releases: Headline[], pickedChart?: string): PageStory | null {
  if (!headlines.length) return null;
  const kept = { ...c, headlines };
  const release = releaseFor(kept, releases);
  const picked = pickHeadlines(headlines, release);
  if (!picked) return null;
  const used = [...headlines, ...(release ? [release] : [])].filter((h) => picked.some((p) => p.url === h.url));
  const date = day(used.map((h) => h.published).sort()[0]!);
  return { id: `${c.key}-${day(headlines[0]!.published)}`, date, topic: c.topic.label(c.country?.name), ...((c.topic.chartId ?? pickedChart) ? { chartId: (c.topic.chartId ?? pickedChart)! } : {}), ...(c.topic.groupId ? { groupId: c.topic.groupId } : {}), headlines: picked };
}

/** "tariff.CAN-2026-10-24" → key and first day. */
export function parseStoryId(id: string): { key: string; day: string } | null {
  const m = id.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);
  return m ? { key: m[1]!, day: m[2]! } : null;
}

/**
 * The page's cards: earlier ones kept until STORY_TTL_DAYS after their date, a fresh card replacing the earlier one with
 * its id (more headlines may have changed the pick), and a fresh card that is the same key within STORY_WINDOW_DAYS of
 * an earlier card dropped (the earlier one, from when the story broke, stays). Newest first, capped.
 */
export function mergeStories(previous: PageStory[], fresh: PageStory[], now: string): PageStory[] {
  const cutoff = day(new Date(Date.parse(now) - STORY_TTL_DAYS * DAY).toISOString());
  const byId = new Map(previous.filter((s) => s.date >= cutoff).map((s) => [s.id, s]));
  const gap = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;
  for (const f of fresh) {
    if (f.date < cutoff) continue;
    if (byId.has(f.id)) {
      byId.set(f.id, f);
      continue;
    }
    const p = parseStoryId(f.id)!;
    const continues = [...byId.values()].some((s) => {
      const q = parseStoryId(s.id);
      return q?.key === p.key && gap(q.day, p.day) <= STORY_WINDOW_DAYS;
    });
    if (!continues) byId.set(f.id, f);
  }
  const perChart = new Map<string, number>();
  return [...byId.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .filter((s) => {
      // Chartless stories are limited per topic (the key in the id), like charted ones per chart; a story filtered to one law or case is its own topic.
      const group = (s.groupId ? undefined : s.chartId) ?? parseStoryId(s.id)?.key ?? s.id;
      const n = perChart.get(group) ?? 0;
      if (n >= MAX_PER_CHART) return false;
      perChart.set(group, n + 1);
      return true;
    })
    .slice(0, MAX_STORIES);
}

/** The file to write: `asOf` moves only when the stories change, so an unchanged page is an unchanged file. */
export function pageFile(previous: PageNewsFile | null, stories: PageStory[], now: string): PageNewsFile {
  const same = previous && JSON.stringify(previous.stories) === JSON.stringify(stories);
  return { asOf: same && previous.asOf ? previous.asOf : day(now), stories };
}
