import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { neutralityProblem } from "../faq/check";
import { sourceNotAllowed } from "../faq/sources";
import { BANNED_WORDS, CAUSAL_PHRASES } from "./caption";
import type { Insight, Why } from "./types";

/**
 * Why a number moved, researched for every data draft: Claude reads the agency's own release for the period (and other
 * sources on the owner's list: federal agencies, CRS/CBO/GAO, the Federal Reserve, universities) and mainstream news
 * reporting (NEWS_OUTLETS) to corroborate it and to add reasons the agency's write-up does not give, then writes one
 * attributed sentence for the post and a few paragraphs for the Instagram carousel. Code then checks it:
 *
 *   - every source is an allowed agency site (pipeline/faq/sources.ts) or a news report from NEWS_OUTLETS (never an
 *     opinion page), and is a page the model actually opened or found in this request, so a citation cannot be made up;
 *   - news is corroborated: a why that cites news cites at least two different outlets;
 *   - the carousel paragraphs carry no figures but years (the breakdown slide carries the verified numbers);
 *   - the FAQ neutrality rules: no loaded words, parties or politicians, and no sentence pairing a cause word with a
 *     policy word (what a release measured, not a verdict on a policy);
 *   - the post sentence names its source.
 *
 * A failing answer is retried with the reason; after three tries the draft opens without one (and says so), falling
 * back to the "How to read this" slide. A person still approves every draft.
 */

const MODEL = process.env.SOCIAL_WHY_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.SOCIAL_WHY_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";

/** The release pages to start from, by series id or dataset: the agency's own write-up of each period's data. */
export const RELEASE_PAGES: Record<string, string[]> = {
  "energy.power": ["https://www.eia.gov/electricity/monthly/update/", "https://www.eia.gov/outlooks/steo/report/elec_coal_renew.php"],
  "energy.spr": ["https://www.eia.gov/petroleum/weekly/", "https://www.energy.gov/ceser/strategic-petroleum-reserve"],
  "energy.crude": ["https://www.eia.gov/petroleum/weekly/", "https://www.eia.gov/outlooks/steo/report/us_oil.php"],
  "energy.petroleum": ["https://www.eia.gov/petroleum/weekly/", "https://www.eia.gov/outlooks/steo/report/us_oil.php"],
  "energy.gas_production": ["https://www.eia.gov/naturalgas/weekly/", "https://www.eia.gov/outlooks/steo/report/natgas.php"],
  "energy.lng": ["https://www.eia.gov/naturalgas/weekly/", "https://www.eia.gov/outlooks/steo/report/natgas.php"],
  gas: ["https://www.eia.gov/petroleum/gasdiesel/", "https://www.eia.gov/petroleum/weekly/", "https://www.eia.gov/outlooks/steo/report/prices.php"],
  trade: ["https://www.bea.gov/data/intl-trade-investment/international-trade-goods-and-services", "https://www.census.gov/foreign-trade/current/index.html"],
  encounters: ["https://www.cbp.gov/newsroom/stats/nationwide-encounters", "https://www.cbp.gov/newsroom/media-releases/all"],
  ice: ["https://www.ice.gov/statistics"],
  executive_orders: ["https://www.federalregister.gov/presidential-documents/executive-orders"],
  laws: ["https://www.congress.gov/public-laws/119th-congress"],
};

export function releasePages(insight: Pick<Insight, "seriesId" | "dataset">): string[] {
  const [prefix] = Object.keys(RELEASE_PAGES).filter((k) => insight.seriesId.startsWith(k)).sort((a, b) => b.length - a.length);
  return RELEASE_PAGES[prefix ?? insight.dataset] ?? [];
}

/**
 * Mainstream outlets whose straight news reporting may corroborate a release or add reasons it does not give, by host.
 * The owner's rule: agency write-ups can lag or say little, which does not make well-reported reasons untrue. Outlets
 * rated Center, Lean Left or Lean Right by AllSides (read 2026-10-27; CNBC added by the owner), so the reasons do not
 * lean on either end; opinion pages are never sources (OPINION_PATH).
 */
export const NEWS_OUTLETS: Record<string, string> = {
  "reuters.com": "Reuters",
  "apnews.com": "AP",
  "bloomberg.com": "Bloomberg",
  "wsj.com": "The Wall Street Journal",
  "cnbc.com": "CNBC",
  "marketwatch.com": "MarketWatch",
  "bbc.com": "BBC",
  "nytimes.com": "The New York Times",
  "npr.org": "NPR",
  "axios.com": "Axios",
  "abcnews.go.com": "ABC News",
  "cbsnews.com": "CBS News",
  "nbcnews.com": "NBC News",
  "politico.com": "Politico",
  "thehill.com": "The Hill",
  "foxbusiness.com": "Fox Business",
  "washingtonexaminer.com": "Washington Examiner",
  "washingtontimes.com": "The Washington Times",
};
const OPINION_PATH = /\/(?:opinions?|commentisfree|editorials?|columns?|columnists?|blogs?|op-ed|analysis\/opinion)(?:\/|$)/i;

/** The outlet a news URL belongs to, or null (not an outlet, or an opinion page). */
export function newsOutlet(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const key = Object.keys(NEWS_OUTLETS).find((h) => host === h || host.endsWith(`.${h}`));
  return key && u.protocol === "https:" && !OPINION_PATH.test(u.pathname) ? NEWS_OUTLETS[key]! : null;
}

/** The hosts both web tools may reach: the main agencies and the outlets (the tools take at most 64). */
const AGENCY_SEARCH = ["eia.gov", "energy.gov", "bea.gov", "census.gov", "trade.gov", "ustr.gov", "cbp.gov", "dhs.gov", "ice.gov", "bls.gov", "treasury.gov", "usda.gov", "federalreserve.gov", "stlouisfed.org", "newyorkfed.org", "dallasfed.org", "cbo.gov", "congress.gov", "gao.gov", "federalregister.gov", "whitehouse.gov"];
const WEB_DOMAINS = [...AGENCY_SEARCH, ...Object.keys(NEWS_OUTLETS)];

/** Short names a post sentence may attribute to. */
const ATTRIBUTION = new RegExp(
  `\\b(EIA|Energy Information Administration|Energy Department|Census|Census Bureau|BEA|Bureau of Economic Analysis|Commerce Department|Commerce data|CBP|Customs and Border Protection|ICE|DHS|Homeland Security|BLS|Labor Department|Treasury|the Fed|Federal Reserve|CBO|CRS|GAO|Federal Register|Congress\\.gov|USDA|Agriculture Department|Associated Press|Wall Street Journal|WSJ|New York Times|${Object.values(NEWS_OUTLETS).map((n) => n.replace(/^The /, "")).join("|")})\\b`,
);
const POST_LINE_MAX = 130;
const PARAGRAPH_MAX = 280;
/** The carousel slide's paragraphs together: about what one 4:5 slide holds at a readable size. */
export const WHY_MAX = 760;

const SYSTEM = `You explain, for InsideGov (a nonpartisan site of U.S. government data), why one number in a new data release moved, so a social post and an Instagram carousel can say so. Always finish by calling the record_why tool.

Research first. Open the release pages you are given and find the agency's own write-up of this period (search the allowed sites when the page has moved or a later edition exists). Then search mainstream news reporting of the same release (Reuters, AP, Bloomberg, The Wall Street Journal, CNBC and the other searchable outlets) to corroborate it and to find the reasons reporters give that the agency's write-up does not, such as what kinds of buyers, projects or events are behind a category. Agency write-ups often lag or say little; a reason that several outlets report is still a reason. Other allowed sources (federal agencies, CRS, CBO, GAO, the Federal Reserve, universities) can add a forecast or a longer trend. Never use opinion pieces, columns, think tanks, advocacy groups or company marketing.

Sourcing rules: take figures and categories from the agency. A reason that comes from news must be reported by at least two different outlets, and is attributed to them by name ("Reuters and Bloomberg report ..."). When the agency and news agree, name the agency.

What to write:
- caption_line: one sentence of at most ${POST_LINE_MAX} characters for the post, naming its source ("EIA cites warmer weather and ...", "Reuters and Bloomberg tie it to chips for data centers"). It follows a sentence that already gives the number, so do not repeat the number. Use a figure only if it is one of the facts' texts, exactly as written.
- title: 3 to 6 words for the carousel slide, such as "Why it went up", "Why it fell", "What changed".
- paragraphs: 2 to 4 short paragraphs (each under ${PARAGRAPH_MAX} characters, ${WHY_MAX} together: they fill one slide) that expand on the reasons: what the agency says moved it, which parts or sources drove it, and any longer trend or outlook the sources give. Words only: no figures, percentages or amounts (years are fine). Name the agency or the outlets in each claim.
- sources: every page you used, with a short name ("EIA Electricity Monthly Update, October 2026") and its exact URL as you opened it.

Rules: say only what the sources say. State reasons as the source does ("EIA says", "Census reports"), never as your own conclusion. No adjectives that judge or dramatize, no party or politician names, and no verdicts on whether a policy worked or what a policy caused; if a source ties a change to a policy, describe the timing ("after the tariff took effect"), not the effect. If the sources give no reason, say what they do report (which parts changed) and nothing more.`;

const TOOL: Anthropic.Beta.BetaTool = {
  name: "record_why",
  description: "Record why the number moved, with its sources.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      caption_line: { type: "string" },
      title: { type: "string" },
      paragraphs: { type: "array", items: { type: "string" } },
      sources: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: "string" } }, required: ["name", "url"], additionalProperties: false } },
    },
    required: ["caption_line", "title", "paragraphs", "sources"],
    additionalProperties: false,
  },
};
const answer = z.object({
  caption_line: z.string(),
  title: z.string(),
  paragraphs: z.array(z.string()),
  sources: z.array(z.object({ name: z.string(), url: z.string() })),
});

/** A breakdown row's change with its sign ("+16.9B kWh"). */
export function signedFact(insight: Pick<Insight, "facts">, id: string): string {
  const f = insight.facts.find((x) => x.id === id);
  if (!f) return "";
  return parseFloat(f.text.replace(/[^\d.]/g, "")) === 0 ? f.text : `${(f.value as number) < 0 ? "−" : "+"}${f.text}`;
}

export function whyPrompt(insight: Insight): string {
  return JSON.stringify(
    {
      headline: insight.headline,
      what_the_post_says: insight.template,
      period: insight.period,
      released: insight.release?.releasedOn ?? null,
      facts: insight.facts.map((f) => ({ id: f.id, text: f.text })),
      breakdown: insight.breakdown?.blocks.map((b) => ({ label: b.label, rows: b.rows.map((r) => `${r.name}: ${signedFact(insight, r.fact)}`) })) ?? null,
      context: insight.context,
      release_pages: releasePages(insight),
    },
    null,
    2,
  );
}

const normalize = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
const YEARS = /\b(?:19|20)\d\d\b/g;

/** Every reason the answer fails (none: it passes). `seen` are the URLs the model opened or found in this request. */
export function checkWhy(w: Why, seen: ReadonlySet<string>, facts: Insight["facts"]): string[] {
  const errors: string[] = [];
  if (!w.captionLine.trim()) errors.push("caption_line is empty");
  if (w.captionLine.length > POST_LINE_MAX) errors.push(`caption_line is ${w.captionLine.length} characters; the limit is ${POST_LINE_MAX}`);
  if (!ATTRIBUTION.test(w.captionLine)) errors.push("caption_line must name its source (EIA, Census, BEA, CBP, Reuters, ...)");
  const causal = CAUSAL_PHRASES.filter((c) => w.captionLine.toLowerCase().includes(c));
  if (causal.length) errors.push(`caption_line: say what the source cites or reports instead of "${causal.join('", "')}"`);
  const allowedNums = new Set(facts.flatMap((f) => f.text.match(/\d[\d,.]*/g) ?? []));
  const strayNums = (w.captionLine.match(/\d[\d,.]*/g) ?? []).filter((n) => !allowedNums.has(n.replace(/[.,]$/, "")) && !/^(?:19|20)\d\d$/.test(n));
  if (strayNums.length) errors.push(`caption_line uses numbers that are not facts: ${strayNums.join(", ")}`);
  if (w.paragraphs.length < 2 || w.paragraphs.length > 4) errors.push(`${w.paragraphs.length} paragraphs; write 2 to 4`);
  const len = w.paragraphs.join(" ").length;
  if (len > WHY_MAX) errors.push(`the paragraphs run to ${len} characters; keep them to ${WHY_MAX} together so they fit one slide`);
  for (const p of w.paragraphs) {
    if (p.length > PARAGRAPH_MAX) errors.push(`a paragraph is ${p.length} characters; keep each under ${PARAGRAPH_MAX}`);
    if (/\d/.test(p.replace(YEARS, ""))) errors.push(`paragraphs are words only (years apart): "${p.slice(0, 60)}..."`);
  }
  const words = new Set([w.captionLine, w.title, ...w.paragraphs].join(" ").toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? []);
  const banned = BANNED_WORDS.filter((b) => words.has(b) && !["only", "just", "record", "records", "caused"].includes(b));
  if (banned.length) errors.push(`uses loaded or partisan words: ${banned.join(", ")}`);
  for (const text of [w.captionLine, ...w.paragraphs]) {
    const problem = neutralityProblem(text);
    if (problem) errors.push(problem);
  }
  if (w.sources.length === 0) errors.push("no sources");
  const seenNorm = new Set([...seen].map(normalize));
  const outlets = new Set<string>();
  for (const s of w.sources) {
    const outlet = newsOutlet(s.url);
    const not = outlet ? null : sourceNotAllowed(s.url);
    if (not) errors.push(`${not}, and not a news report from the listed outlets`);
    else if (!seenNorm.has(normalize(s.url))) errors.push(`${s.url} was not opened or found in this research; cite only pages you read`);
    if (outlet) outlets.add(outlet);
  }
  if (outlets.size === 1) errors.push(`news cited from ${[...outlets][0]} only; a reason from news needs at least two outlets reporting it`);
  return errors;
}

/** URLs the server tools returned in a response: fetched pages and search results. */
function urlsIn(content: Anthropic.Beta.BetaContentBlock[]): string[] {
  const out: string[] = [];
  for (const b of content) {
    if (b.type === "web_fetch_tool_result" && b.content.type === "web_fetch_result") out.push(b.content.url);
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) for (const r of b.content) out.push(r.url);
  }
  return out;
}

export type WhyResult = { why: Why; model: string } | { error: string };

export async function researchWhy(client: Anthropic, insight: Insight): Promise<WhyResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: whyPrompt(insight) }];
  const seen = new Set<string>(releasePages(insight));
  let lastErrors: string[] = [];
  for (let attempt = 1, turns = 0; attempt <= 3 && turns < 12; turns++) {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: EFFORT },
        system: SYSTEM,
        tools: [
          { type: "web_fetch_20260209", name: "web_fetch", allowed_domains: WEB_DOMAINS, max_uses: 10 },
          { type: "web_search_20260209", name: "web_search", allowed_domains: WEB_DOMAINS, max_uses: 6 },
          TOOL,
        ],
        tool_choice: { type: "auto" },
        messages,
      });
    } catch (err) {
      if (err instanceof Anthropic.APIError) return { error: `API ${err.status ?? ""} ${err.message.slice(0, 200)}` };
      throw err;
    }
    if (res.stop_reason === "refusal") return { error: `refused (${res.stop_details?.category ?? "no category"})` };
    for (const u of urlsIn(res.content)) seen.add(u);
    messages.push({ role: "assistant", content: res.content });
    // A long research turn pauses; send it back as is to let it continue.
    if (res.stop_reason === "pause_turn") continue;
    const call = res.content.find((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === "tool_use" && c.name === TOOL.name);
    const parsed = answer.safeParse(call?.input);
    if (!call || !parsed.success) {
      attempt++;
      messages.push({ role: "user", content: "Finish by calling the record_why tool with your answer." });
      continue;
    }
    const why: Why = {
      title: parsed.data.title.trim(),
      captionLine: parsed.data.caption_line.trim().replace(/\s+/g, " "),
      paragraphs: parsed.data.paragraphs.map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean),
      sources: parsed.data.sources.map((s) => ({ name: s.name.trim(), url: s.url.trim() })),
    };
    lastErrors = checkWhy(why, seen, insight.facts);
    if (lastErrors.length === 0) return { why, model: res.model };
    attempt++;
    messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Rejected: ${lastErrors.join("; ")}. Fix these and call record_why again.` }] });
  }
  return { error: `no sourced explanation passed the checks (${lastErrors.join("; ") || "no answer"})` };
}
