/**
 * The outlets the news watcher reads, their leans, and the agencies whose own data releases sit beside them. One place
 * for all of it: the page-level "In the news" cards (news/pages.ts) and the social news drafts (news/watch.ts) read the
 * same feeds.
 *
 * Leans are AllSides Media Bias Ratings of each outlet's NEWS coverage (not its opinion pages), as published on
 * allsides.com/media-bias/ratings and read on ALLSIDES_READ_ON. Re-read them now and then and update the date; a rating
 * AllSides changes is changed here only. Licence (allsides.com/terms-of-use, read 2026-10-27): "AllSides Media Bias
 * Ratings™ are licensed under a Creative Commons Attribution-NonCommercial 4.0 International License", free for
 * noncommercial use with attribution; commercial use needs AllSides' written consent. The page that shows a lean must
 * carry their online credit line (ALLSIDES_CREDIT). Every feed was fetched with the watcher's own user agent on FEEDS_TESTED_ON;
 * a feed that blocks it is dropped, never fetched with a browser's user agent.
 *
 * Opinion is kept out three ways, per outlet: by feed choice (Fox keeps its opinion pieces in a feed of their own,
 * which is not read), by URL (OPINION_URL plus the outlet's own `opinionUrl`: /opinion/, the Guardian's
 * /commentisfree/, show blogs), and, where an outlet gives no signal in either (HuffPost runs news and commentary
 * under the same /entry/ paths), by the Claude relevance check: `needsCheck` headlines are used only when the check
 * calls them straight news, so without an API key they are left out.
 *
 * Unavailable when tested: Reuters (no RSS: every feed URL is dead or needs a login, retested 2026-10-28), CNN (feeds frozen), the Washington Post and Newsmax (block bots). MS NOW
 * left out (its feeds are mostly opinion and show blogs), as are White House press statements (one side's framing).
 */

export const ALLSIDES_READ_ON = "2026-10-27";
/** AllSides' attribution for online works (allsides.com/trademark-guidelines), to show wherever a lean is shown. */
export const ALLSIDES_CREDIT = "AllSides Media Bias Ratings™ by AllSides.com are licensed under a Creative Commons Attribution-NonCommercial 4.0 International License.";
export const FEEDS_TESTED_ON = "2026-10-28";

export type OutletLean = "Left" | "Lean Left" | "Center" | "Lean Right" | "Right";
export type Side = "left" | "center" | "right";

export function sideOf(lean: OutletLean | "Data"): Side {
  return lean === "Left" || lean === "Lean Left" ? "left" : lean === "Lean Right" || lean === "Right" ? "right" : "center";
}

export type Outlet = {
  /** Key of the outlet's icon in public/outlet-logos/ (lowercase letters and digits). */
  id: string;
  name: string;
  lean: OutletLean;
  /** News-only feeds (no opinion feeds). */
  feeds: string[];
  /** URLs of the outlet's opinion, column and show-blog pieces (on top of OPINION_URL). */
  opinionUrl?: RegExp;
  /** The outlet gives no opinion signal: its headlines need the Claude check to count. */
  needsCheck?: boolean;
  /** Read only for a side no roster outlet covered (AP's only feed lags about 14 hours; the end reserves are mostly commentary). */
  reserve?: boolean;
};

/** Opinion and non-news URLs at any outlet. */
export const OPINION_URL = /\/(opinions?|commentisfree|editorials?|columns?|columnists?|commentary|op-?eds?|letters|podcasts?|video|videos|live|newsletters?|quizzes|crosswords?)\//i;
/** Opinion and non-news titles at any outlet ("Opinion | ...", "Analysis: ...", "Live updates: ..."). */
export const OPINION_TITLE = /^(opinion|analysis|commentary|editorial|op-ed|perspective|column|letters?|live( updates)?|watch|listen|podcast|quiz)\s*[:|–—-]|\|\s*opinion\b/i;

/**
 * Roster order within a side is coverage strength (the national newsroom that covers more of these topics first): when
 * several outlets on one side headlined a story, the card shows the earliest in this list that covered it most.
 */
export const OUTLETS: Outlet[] = [
  // Left
  {
    id: "huffpost", name: "HuffPost", lean: "Left", needsCheck: true,
    feeds: ["https://chaski.huffpost.com/us/auto/vertical/politics", "https://chaski.huffpost.com/us/auto/vertical/us-news"],
  },
  { id: "guardian", name: "The Guardian", lean: "Left", feeds: ["https://www.theguardian.com/us-news/us-politics/rss", "https://www.theguardian.com/us-news/us-news/rss", "https://www.theguardian.com/environment/national-parks/rss", "https://www.theguardian.com/environment/environment/rss"] },
  // Lean Left
  {
    id: "nytimes", name: "New York Times", lean: "Lean Left",
    feeds: ["https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", ...["Climate", "Health", "Education", "Science"].map((s) => `https://rss.nytimes.com/services/xml/rss/nyt/${s}.xml`)],
    opinionUrl: /\/(briefing|athletic|wirecutter|well|style|dealbook)\//i,
  },
  {
    id: "nbcnews", name: "NBC News", lean: "Lean Left",
    feeds: ["https://feeds.nbcnews.com/nbcnews/public/politics", "https://feeds.nbcnews.com/nbcnews/public/business", "https://feeds.nbcnews.com/nbcnews/public/news"],
    opinionUrl: /\/(think|meet-the-press|nbc-out|select|shopping)\//i,
  },
  {
    id: "cbsnews", name: "CBS News", lean: "Lean Left",
    feeds: ["https://www.cbsnews.com/latest/rss/politics", "https://www.cbsnews.com/latest/rss/moneywatch", "https://www.cbsnews.com/latest/rss/us", "https://www.cbsnews.com/latest/rss/health", "https://www.cbsnews.com/latest/rss/science"],
    opinionUrl: /\/(face-the-nation|60-minutes|essentials)\//i,
  },
  // AllSides rates both Lean Left (read 2026-10-28; Politico's editorial review kept Lean Left over a Center blind survey). Both carry the trade-policy beat the older roster missed (Canada talks, tariff lists).
  {
    id: "politico", name: "Politico", lean: "Lean Left",
    feeds: ["https://rss.politico.com/politics-news.xml", "https://rss.politico.com/economy.xml", "https://rss.politico.com/congress.xml", "https://rss.politico.com/healthcare.xml", "https://rss.politico.com/energy.xml"],
    opinionUrl: /\/(magazine|playbook|inside-congress|politico-pro|podcasts?)\//i,
  },
  { id: "axios", name: "Axios", lean: "Lean Left", feeds: ["https://api.axios.com/feed/"] },
  // AllSides Lean Left, read 2026-10-28 (medium confidence). Business and markets beat: the tariff, trade-deficit and Fed stories the news-and-politics feeds miss. Feeds tested 2026-10-28; its stale Finance feed (id 10000664) is not used.
  {
    id: "cnbc", name: "CNBC", lean: "Lean Left",
    feeds: ["https://www.cnbc.com/id/100003114/device/rss/rss.html", "https://www.cnbc.com/id/10000113/device/rss/rss.html", "https://www.cnbc.com/id/20910258/device/rss/rss.html"],
    opinionUrl: /\/(select|pro|investingclub|make-it|cnbc-pro)\//i,
  },
  { id: "apnews", name: "Associated Press", lean: "Lean Left", reserve: true, feeds: ["https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss"] },
  {
    id: "abcnews", name: "ABC News", lean: "Lean Left", reserve: true,
    feeds: ["https://abcnews.go.com/abcnews/politicsheadlines", "https://abcnews.go.com/abcnews/usheadlines"],
    opinionUrl: /\/(ThisWeek|GMA|Nightline)\//,
  },
  { id: "npr", name: "NPR", lean: "Lean Left", reserve: true, feeds: ["https://feeds.npr.org/1014/rss.xml", "https://feeds.npr.org/1017/rss.xml"] },
  // AllSides Lean Left (medium confidence, read 2026-10-28). Reserve: it is a slower, broader newsroom than the roster's.
  { id: "pbsnewshour", name: "PBS NewsHour", lean: "Lean Left", reserve: true, feeds: ["https://www.pbs.org/newshour/feeds/rss/politics", "https://www.pbs.org/newshour/feeds/rss/economy"] },
  { id: "motherjones", name: "Mother Jones", lean: "Left", reserve: true, needsCheck: true, feeds: ["https://www.motherjones.com/politics/feed/"] },
  // Center
  // WSJ's "social" politics and economy feeds carry social-post blurbs in place of headlines; its U.S. and business
  // news feeds carry the headlines.
  { id: "wsj", name: "Wall Street Journal", lean: "Center", feeds: ["https://feeds.content.dowjones.io/public/rss/RSSUSnews", "https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness"] },
  { id: "bbc", name: "BBC News", lean: "Center", feeds: ["https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", "https://feeds.bbci.co.uk/news/business/rss.xml"], opinionUrl: /\/(sport|av|sounds|programmes)\//i },
  { id: "thehill", name: "The Hill", lean: "Center", feeds: ["https://thehill.com/homenews/feed/", "https://thehill.com/policy/feed/", "https://thehill.com/business/feed/", ...["energy-environment", "healthcare", "defense", "technology", "transportation"].map((s) => `https://thehill.com/policy/${s}/feed/`)], opinionUrl: /\/(changing-america|in-the-know|hilltv)\//i },
  { id: "bloomberg", name: "Bloomberg", lean: "Center", feeds: ["https://feeds.bloomberg.com/politics/news.rss", "https://feeds.bloomberg.com/economics/news.rss"] },
  // AllSides Center, read 2026-10-28 (a Dec 2025 blind survey said Lean Left; the Mar 2026 editorial review kept it Center). Its opinion pages are under /opinion/.
  { id: "newsweek", name: "Newsweek", lean: "Center", feeds: ["https://www.newsweek.com/rss"] },
  // Lean Right
  {
    id: "washingtonexaminer", name: "Washington Examiner", lean: "Lean Right",
    feeds: ["news", "policy", "economy", "immigration", "energy", "white-house", "healthcare", "education"].map((s) => `https://www.washingtonexaminer.com/section/${s}/feed/`),
    opinionUrl: /\/(restoring-america|daily-on-[a-z-]+|beltway-confidential|magazine)\//i,
  },
  {
    id: "washingtontimes", name: "Washington Times", lean: "Lean Right",
    feeds: ["politics", "business-economy", "national", "environment"].map((s) => `https://www.washingtontimes.com/rss/headlines/news/${s}/`),
  },
  // Its feed is mostly commentary with no news/opinion URL signal (tested 2026-10-28): reserve, and the Claude check decides. AllSides rates "National Review (News)" Lean Right.
  { id: "nationalreview", name: "National Review", lean: "Lean Right", reserve: true, needsCheck: true, feeds: ["https://www.nationalreview.com/feed/"] },
  { id: "foxbusiness", name: "Fox Business", lean: "Lean Right", feeds: ["economy", "markets", "latest"].map((s) => `https://moxie.foxbusiness.com/google-publisher/${s}.xml`), opinionUrl: /\/(media|lifestyle|personal-finance)\//i },
  // Right
  {
    id: "foxnews", name: "Fox News", lean: "Right",
    feeds: ["https://moxie.foxnews.com/google-publisher/politics.xml", "https://moxie.foxnews.com/google-publisher/us.xml", "https://moxie.foxnews.com/google-publisher/latest.xml"],
    opinionUrl: /\/(media|entertainment|lifestyle|sports|shows|transcript)\//i,
  },
  { id: "nypost", name: "New York Post", lean: "Right", feeds: ["politics", "us-news", "business"].map((s) => `https://nypost.com/${s}/feed/`), opinionUrl: /\/(sports|entertainment|lifestyle|fashion|real-estate|shopping)\//i },
  { id: "breitbart", name: "Breitbart", lean: "Right", reserve: true, needsCheck: true, feeds: ["https://feeds.feedburner.com/breitbart"] },
];

/**
 * Agencies whose own release of the data sits on a card as lean "Data" (the facts, beside the outlets' framing). A
 * release is an RSS item from the agency's feed; `match` keeps the agency's items that are data releases (CBP's feed is
 * mostly seizures and arrests). The topic catalog (topics.ts) says which release goes with which chart. Treasury's
 * Monthly Treasury Statement and Freddie Mac's mortgage survey have no feed the watcher can read (Treasury's press feed
 * times out, Freddie Mac's blocks it), so their stories show a Center outlet instead.
 */
export type DataSource = { id: string; name: string; feeds: string[]; match?: RegExp };

export const DATA_SOURCES: DataSource[] = [
  {
    id: "bls", name: "Bureau of Labor Statistics",
    feeds: ["https://www.bls.gov/feed/cpi.rss", "https://www.bls.gov/feed/empsit.rss", "https://www.bls.gov/feed/realer.rss"],
  },
  { id: "bea", name: "Bureau of Economic Analysis", feeds: ["https://apps.bea.gov/rss/rss.xml"] },
  { id: "eia", name: "Energy Information Administration", feeds: ["https://www.eia.gov/rss/press_rss.xml", "https://www.eia.gov/rss/todayinenergy.xml"] },
  {
    id: "cbp", name: "U.S. Customs and Border Protection",
    feeds: ["https://www.cbp.gov/rss/newsroom/media-releases"],
    match: /\b(monthly (update|operational update)|encounters|apprehensions)\b/i,
  },
  { id: "uscis", name: "USCIS", feeds: ["https://www.uscis.gov/news/rss-feed/59144"] },
  { id: "federalregister", name: "Federal Register", feeds: ["https://www.federalregister.gov/api/v1/documents.rss?conditions%5Btype%5D%5B%5D=PRESDOCU&order=newest"] },
];

export const outletById = new Map(OUTLETS.map((o) => [o.id, o]));
export const dataSourceById = new Map(DATA_SOURCES.map((d) => [d.id, d]));

/** Whether a headline is opinion, analysis or other non-news by its URL or title (the Claude check catches the rest). */
export function isOpinion(h: { title: string; url: string }, outlet?: Pick<Outlet, "opinionUrl">): boolean {
  let path = h.url;
  try {
    path = new URL(h.url).pathname;
  } catch {
    /* not a URL: test the string as is */
  }
  return OPINION_URL.test(path) || Boolean(outlet?.opinionUrl?.test(path)) || OPINION_TITLE.test(h.title);
}
