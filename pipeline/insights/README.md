# pipeline/insights/ — social posts

Turns new government data into social posts: a chart image with a one- or two-sentence caption, then (on X and Bluesky)
a thread that says more, and a 4:5 Instagram carousel posted by hand.
Because the content is political, **a person approves every post**. Two things start a post: monthly data just came out
(one summary post per release, at a steady pace, never in bursts), **or a topic the site has data on is in the news**
(see "News drafts" below): a chart of diesel prices when diesel is in the headlines, the tariff rate collected on
Canada when tariffs on Canada are. **News comes first**: a news post goes out ahead of a waiting data post, and weekly
series (gas, diesel, the Strategic Petroleum Reserve) and the single electricity sources post *only* when the news is
about them. Bluesky and X are supported; both are off until set up.

```
data refresh (a freshness workflow)                         release day = the day the workflow sees the data
  └─ .github/actions/social-drafts
       ├─ run.ts          detect insights in what the refresh added      detect.ts, collect.ts
       │                  stamp the release date, lag, freshness window  freshness.ts
       │                  verify every fact against its data rows        verify.ts
       │                  caption with the Claude API, checked in code   caption.ts
       │                  render the chart                               chart.tsx
       └─ open-issues.ts  one `social-draft` issue per draft             issue.ts
you: label `social-approved` (queues it) or close (rejects it)
  └─ .github/workflows/social-post.yml, weekdays                       post-next.ts → schedule.ts
       expire stale drafts, pick at most one, post to Bluesky and X    bluesky.ts, x.ts

headlines, hourly (.github/workflows/social-news.yml)
  └─ .github/actions/social-drafts (news: true)
       news/watch.ts      the page cards' story detector (news/cards.ts): the outlets' feeds,
                          one topic per headline, a story over a few days  news/topics.ts PAGE_TOPICS
                          one development, 2+ outlets, a chart  (Claude)   news/classify.ts
                          which stories get a chart the site can post      news/social.ts
                          context chart from data the site has             news/charts.ts
                          verify, caption, render: as above
       open-issues.ts     `social-draft` + `social-news` issue, one email
you: label `social-approved`  →  posts within minutes (no slot)        post-next.ts --slot news → schedule.ts pickNews
                              a data slot stands down while a news draft waits
```

## What becomes a post

Detectors (`detect.ts`, pure, tested) look only at the **newest** observation of a series:

| Kind | Rule |
| --- | --- |
| New high / low | Highest (lowest) since a value at least that extreme, at least 3 years earlier; or beyond everything in at least 5 years of data ("in data going back to …", never "record"). Seasonal series (electricity, gas production, LNG, laws by month) compare like months. Records in a steadily growing series (solar) are scored down. |
| Biggest move | The newest one-period change (week, month, fiscal year; year over year for seasonal series) is the largest in its direction in 3 years, and at least 1%. |
| Same point in term | The current presidential term against every earlier term at the same elapsed time. **Quarterly** (March, June, September, December data), not every refresh. Needs at least three terms; the caption names all earlier terms or none; terms are never coloured by party. |
| Latest reading | The routine post for each dataset's headline series (crude output, total electricity generation, trade deficit, southwest border encounters, executive orders and laws per month): the newest value, its change on the period and on the year. Only when the same refresh produced nothing notable for that series, so every update has something to post but nothing posts twice. |

**News-only series** (`newsOnly` in `datasets.ts`, `Series.newsOnly`) get none of these. They post only when the news is
about them (the news lane charts them like any other):

| Series | Why |
| --- | --- |
| Weekly: gas and diesel prices, the Strategic Petroleum Reserve, the 30-year mortgage rate, the federal funds rate, the ten-year Treasury yield | A new reading every week is not news; a story about gas prices is. |
| Single electricity sources: coal, natural gas, nuclear, wind, solar | One release would otherwise give a "record" post for each source. The release gets **one** post, for total generation, and its "What drove it" slide shows each source's change. A source posts alone only when a story is about it. |
| The Economy page's cards: mortgage rate, federal funds rate, ten-year Treasury yield, unemployment, inflation, jobs added, GDP growth, real hourly earnings, household income, the deficit, the debt | Their releases (jobs report, CPI, GDP) are always in the news the same day, so the news lane covers them. Each is computed as its card computes it (`economy.ts`, using the page's `lib/indicator-derive.ts`; deficit and debt merge Treasury's newer figures as the page does), so a post and its card agree. |

## Freshness: posts follow releases

`freshness.ts`. Every draft carries the day its data came out (the freshness workflow's run date; the backfill estimates
it from each series' typical publication lag).

- **Lagged data says so.** If the newest period ended more than **60 days** before the release (EIA's monthly
  electricity data: July figures out in October), the chart carries a "New data, released October 2026 · covers July
  2026" label and the caption must say the data is newly released (the check rejects one without "released"). Data
  within two months of its release (trade, encounters, gas prices) needs neither.
- **Drafts go stale.** A draft can post up to **6 days** after release for weekly data, **21** for monthly, **45** for
  fiscal-year figures; then the scheduler expires it (label `social-expired`, closed). A newer draft for the same series
  supersedes an older one even inside its window.

## Cadence: the schedule

`schedule.ts` (`pickNext`, tested; `simulate` plays it forward). Approving a draft queues it; `social-post.yml` runs at
two weekday slots and posts at most one draft per slot a day:

| Rule | Value |
| --- | --- |
| Slots | Mon–Fri **9:00 a.m. Pacific (noon Eastern)**: working hours on both coasts, after the morning releases. A second slot at **1:00 p.m. Pacific (4:00 p.m. Eastern)** runs only when 3+ drafts are waiting, or on the day the intro posts (so the first chart follows it). No weekend posts. Each slot is a window (9–1 and 1–5 Pacific): GitHub starts scheduled runs hours late or drops them, so the workflow fires every 15 minutes through both windows, and again whenever a draft is approved (the `social-approved` label starts a run, so a draft approved inside a window posts within minutes; outside one, the run exits), and the first run with something to post uses the slot. Slots stay fixed in Pacific time through daylight saving (the UTC cron covers both seasons and `slotAt` drops runs outside the windows). Change `SLOTS` / `TIME_ZONE` in `schedule.ts` to move them. |
| Caps | 2 a day, 8 in any 7 days, at least 3 hours apart. |
| Topic mix | A topic (energy, gas, trade, encounters, ICE, executive orders, laws) posts at most twice in 7 days, and one that posted in the last 36 hours waits if anything else is ready. |
| Order | The intro thread first. Then notability × urgency (closer to going stale = sooner) × rotation (topics not seen for a while first). |
| News first | A slot stands down while an approved, fresh news draft is waiting and the news lane has room today (it posts within minutes; the data post follows in the same window, 45 minutes later). A data draft for a series a news post charted in the last 3 days, on that period or a later one, is expired as covered (the news chart shows the same newest figure); a newer period still posts. |

**The plan from tomorrow**: `pnpm insights:plan` writes `social-drafts/plan.md`, slot by slot for the next 28 days,
from the drafts already out and still fresh plus every upcoming release (estimated from each source's usual lag) that
is sure to give at least a routine reading. That floor is about **3 posts a week**; notable highs, lows and moves
(which cannot be known ahead) add to it. Replaying the last six months the same way (`pnpm insights:backfill`,
`schedule.md`) gave about **4–5 posts a week**: energy 2, gas prices 1–2, trade 2 a month, encounters, executive
orders and laws about monthly, ICE yearly.

### Data calendar

When each source publishes, which workflow picks it up, and what usually posts:

| Data | Published | Picked up by | Typical posts |
| --- | --- | --- | --- |
| Gas and diesel prices (EIA via FRED) | weekly, Monday's survey out Monday afternoon | `indicators-freshness` (Mondays 11:43 UTC) | nothing: news-only (posts when gas or diesel is in the news) |
| Strategic Petroleum Reserve (EIA WPSR) | weekly, Wednesdays | `energy-freshness` (Tuesdays) | nothing: news-only |
| EIA monthly energy (oil output and trade, natural gas, LNG, total electricity generation) | monthly, late in the month, 2–3 months back | `energy-freshness` | highs/lows for the month, usually with the "newly released" label; one electricity post for total generation, not one per source |
| Goods trade (Census) | monthly, about 5 weeks after the month | `trade-freshness` (Wednesdays) | deficit reading or a high/low; term comparison quarterly |
| CBP border encounters | monthly, mid-month; fiscal year in October | `encounters-freshness` (Wednesdays) | monthly reading or a high/low; fiscal-year totals |
| Executive orders, laws | continuously | `executive-orders-freshness`, `laws-freshness` (Mondays) | after each month: the month's count (or a new high); quarterly term comparison |
| ICE removals and detention | yearly, curated by hand | no freshness workflow: run `social-drafts.yml` after updating | yearly figures |

## News drafts: posting when a topic is in the news

`news/`. News is the stronger signal, so it leads: a chart is most useful the day its topic is in the news (tariffs on
Canada announced, a diesel deal with Russia, a tanker of Venezuelan crude in Texas). The news watcher listens for that
and drafts a **context chart** from data the site already has. It does not report the news, it gives it background.

**One story detector for the pages and the posts.** The watcher runs the same logic as the pages' "In the news" cards
(`news/cards.ts`, described under "In the news on the pages" below): the outlets' own feeds, one topic per headline, a
story over a few days, the Claude check that keeps only the headlines that are straight news of one development, the
chart pick for a story the page has no chart for, and the two-outlet rule. `news/social.ts` then decides which stories
become drafts. Hourly, so a story is drafted within an hour of its second outlet running it.

**What becomes a draft** (`news/social.ts`, tested in `social.test.ts`):

| Rule | Value |
| --- | --- |
| Outlets | at least 2 (the cards' rule), after the check; the issue lists who covered it, left to right |
| Recency | the story's first kept headline is from the last **24 hours** (`NEWS_STORY_MAX_AGE_HOURS`) |
| A chart | the site has a series for the story (below); a story with none is not drafted (the pages' cards still show it) |
| One per chart | one story per chart in a run; a tariff story naming one partner wins over tariffs in general |
| Volume | at most **2 drafts a run**; the same topic (and partner) at most once in **3 days** (`NEWS_COOLDOWN_DAYS`) |
| Check | the Claude API (`SOCIAL_NEWS_MODEL`, effort `SOCIAL_NEWS_EFFORT`) keeps the same-development headlines, as for the cards. Its answers are saved by the story's set of URLs for 48 hours (`news/state.json` on the `social-drafts` branch), so an unchanged story is not asked about every hour. Without a key, the word rules (shared detail words between outlets) stand alone and outlets that need the check are left out. |

**Which chart a story gets** (`news/social.ts`; topics in `news/topics.ts`):

| Story about | Chart |
| --- | --- |
| Tariffs (a partner by name or demonym, else all countries) | the tariff rate collected on that partner against all countries, monthly, 10 years |
| Diesel, gas prices | weekly diesel / regular gasoline price, 10 years, with its high |
| The Strategic Petroleum Reserve | weekly SPR level, 15 years |
| U.S. oil production, LNG, the trade deficit, border encounters, deportations | the matching series (monthly; ICE removals by fiscal year) |
| Venezuelan oil | total U.S. petroleum imports. The chart says "All countries, not Venezuela alone" and the caption writer is told not to suggest otherwise |
| Electricity (prices, demand, data centers) | total electricity generation |
| Nuclear, coal, solar or wind power | that one source's generation, when most headlines name one source; a mixed story ("renewables", two sources equally) has no single chart |
| Inflation, the jobs report, unemployment, GDP, wages, household income, mortgage rates, the deficit, the national debt | the Economy card's own measure (`economy.*` series, `economy.ts`): inflation as the year-over-year rate, jobs as the monthly change (5 years, against a year earlier), real hourly earnings in latest-month dollars, deficit and debt in dollars. Rates change in "percentage points"; quarters read "Q2 2026". Jobs and debt read against a year earlier because their peak means little |
| A story the page has no chart for | the chart the Claude check picks from the page's postable charts, if one directly measures it (the oil card is never offered: it shows imports and exports) |

Green cards, refugees and the misery index are not chartable here yet (the first two live in the immigration files with
different shapes, the last is a blend no story names). Their stories still appear on the pages' cards. Derived values
(a rate computed from an index) cite the cell they are read at plus how they are derived (`CellRef.derive` in
`types.ts`), so `verify.ts` re-runs them from the rows; Treasury's figures are cited as `treasury_fiscal.json#debt`.

**The comparison point** is the peak in the chart's window, and how far back that peak stands in all the data
("down from a peak of $6.53 a gallon in September 2026, the highest in data going back to 1994"; for a country's
tariff rate, "The peak for Canada was 3.8% in September 2025", so it cannot be read as the all-countries rate). A year
earlier is the fallback, when the latest value is itself the peak ("up 19% from a year earlier, the highest July in
data going back to 1997"). Clauses are dropped from the end until the caption fits 240 characters.

**Feeds** (`news/feeds.ts`, `news/outlets.ts`): the news outlets' own RSS feeds, opinion filtered out (the roster under
"In the news on the pages" below; the end reserves are not read here). The White House's presidential actions feed is no
longer a trigger on its own: an official document used to draft a story before any outlet ran it, now the two-outlet rule
applies like everywhere else. (`SOCIAL_NEWS_SOURCES` is ignored.)

**The link** goes to the chart's own card, with its filter: `/presidency/trade?country=CAN#tariffs` for a country's
tariffs, `/presidency/economy#gas-price`, `/presidency/energy#spr`. Each series' `anchor` (datasets.ts) names the card;
data-release drafts use it too. Card ids are the ones the share button gives (the title slugged, components/charts/ChartShare.tsx),
except cards that set fixed ids (`trade-balance`, `tariffs`, the Economy `chart-*` cards, Energy's `oil`). Rename a card and its anchor must follow.

**The caption** opens with a fixed sentence written by code ("Diesel is in the news.", "Tariffs involving Canada are
in the news.") and then says only what the data shows. The caption check rejects a caption that changes the opening,
and the usual rules apply: every number is a fact from the data (so no rate or figure from a headline can get in),
no loaded words, no causes. The model is told never to describe the news (who announced what, terms, reactions). The
headlines, with each outlet's AllSides lean, are listed in the issue for the reviewer and are never posted. The tariff
chart's context note says the collected rate is not an announced rate and moves months after a change.

**Fresh data: the watcher refreshes it when a release is out** (`news/refresh.ts`, tested in `refresh.test.ts`). A post about
the jobs report or the trade deficit is only as good as the data behind its chart, and the weekly refresh workflows can
trail the release by hours or days. Each hour the watcher checks, for the topics whose data a refresh workflow maintains
(jobs, unemployment, inflation, wages, GDP → `indicators-freshness`; trade deficit → `trade-freshness`; border →
`encounters-freshness`; oil production, LNG, electricity → `energy-freshness`), whether a release is newer than the data
file's last change on the default branch. Two signals say a release is out: an agency's own feed item (the ones behind a
page card's "Data" line) and, because the feeds do not carry every release, a checked news story on the topic. When the
data is behind:

- the topic's refresh workflow is **dispatched** (`gh workflow run`, needs `actions: write` on the watcher). It is
  idempotent and merges its own PR after the full CI gate, so nothing needs approving. It is dispatched again each hour (at
  most every 50 minutes, 8 times per release: FRED trails BLS and BEA by hours) until the data moves;
- a news story on that topic is **held**, not drafted. An agency release holds it until the data catches up; a story alone
  holds it 3 hours (it may not be about a new release at all), then posts with the data we have. The story still expires 24
  hours after it broke;
- a failed check of the file's age never holds or dispatches anything. A dry run (`--no-dispatch`, or the workflow's dry
  run) only logs what it would do. State is the `dispatched` map in `news/state.json`.

The refresh's own data draft follows as usual, and the news-first rules (above) expire it if the news post already charted
that period.

**Speed.** News goes stale in hours, so news drafts skip the weekday slots and go ahead of data posts:

| Rule | Value |
| --- | --- |
| Watch | hourly, around the clock, once the repo variable `SOCIAL_NEWS_ENABLED=true` |
| Notify | one email per run that opens drafts ("news draft to approve"), same `NOTIFY_*` secrets |
| Post | approving (label `social-approved`) triggers the news lane at once, and it also runs after every watch: it posts within minutes, any day or hour (a person approved it) |
| Expiry | **24 hours** after the story was first seen (`NEWS_FRESH_HOURS`); then it is closed as `social-expired` |
| Caps | **2 news posts a day** (`NEWS_MAX_PER_DAY`), **4 posts a day** with data posts (`MAX_TOTAL_PER_DAY`), **45 minutes** after any post (`NEWS_MIN_MINUTES_BETWEEN`); a held post goes out at the next clear run |
| Data slots | stand down while an approved, fresh news draft is waiting (unless the news lane is full for the day); expire a data draft a news post just covered; news posts do not use up the data caps, but a data slot waits 45 minutes after a news post, and topic rotation counts them (a diesel news post holds back a gas-price data post for 36 hours) |

To try it: Actions → "Social news watcher" → Run workflow (dry run ticked prints the drafts). Locally:
`pnpm insights:news` (writes `social-drafts/news`), `-- --no-llm` for word rules and template captions,
`-- --now ISO` to replay the feeds as of an earlier moment.

## In the news on the pages

`news/pages.ts`. Each data page ends with an "In the news" row: one card per story, showing how a left-of-center and a
right-of-center outlet headlined it, beside the agency's own release (or a Center outlet) and the chart it is about,
so readers judge the framing themselves. The pipeline writes `pipeline/output/news_<page>.json` (economy, immigration,
trade, energy) in the UI's schema (`lib/news-types.ts`: `{ asOf, stories: [{ id, date, topic, chartId, headlines:
[{ outletId, outlet, lean, title, url }] }] }`).

```
twice a day (.github/workflows/news-pages.yml, repo variable NEWS_PAGES_ENABLED=true)
  news/pages.ts   read the outlets' and agencies' feeds                  news/feeds.ts, news/outlets.ts
                  + the topic headlines earlier runs saw (Actions cache)
                  one topic per headline, one chart per topic             news/topics.ts PAGE_TOPICS
                  group into stories, add same-story companions           news/cards.ts
                  which are straight news of one development? (Claude)    news/classify.ts checkCandidate
                  outlet rule, data release, merge with earlier cards    news/cards.ts
  changed file → PR → full CI gate → merged                              .github/actions/gate-and-merge
```

**Outlets and leans** (`news/outlets.ts`, one table): leans are AllSides Media Bias Ratings™ of each outlet's news
coverage, read 2026-10-27 (`ALLSIDES_READ_ON`). Licence: CC BY-NC 4.0, free for noncommercial use with attribution
(`ALLSIDES_CREDIT` must appear where leans are shown; commercial use needs AllSides' consent). Every request identifies
the watcher (`InsideGov news watcher (+https://insidegov.fyi)`); a feed that blocks it is dropped, never fetched as a
browser.

| Lean | Outlets (feeds) |
| --- | --- |
| Left | HuffPost (politics, U.S. news; needs the check), The Guardian (U.S. politics) |
| Lean Left | New York Times (Politics, Economy, U.S.), NBC News (politics, business, news), CBS News (politics, MoneyWatch, U.S.); reserves AP (via Flipboard, ~14h lag), ABC News, NPR |
| Center | Wall Street Journal (U.S. news, U.S. business: its "social" feeds carry post blurbs, not headlines), BBC News, The Hill, Bloomberg |
| Lean Right | Washington Examiner, Washington Times, Fox Business |
| Right | Fox News (politics, U.S., latest; not its opinion feed), New York Post |
| End reserves | Mother Jones (Left), Breitbart (Right), both need the check |
| Data | BLS (CPI, jobs, real earnings), BEA (GDP, trade), EIA, CBP (monthly updates), USCIS, Federal Register (presidential documents) |

Unavailable: Reuters (no RSS), CNN (feeds frozen), the Washington Post and Newsmax (block bots); Treasury's statement
and Freddie Mac's mortgage survey have no feed the watcher can read, so those stories show a Center outlet. MS NOW and
White House statements are left out by choice. A reserve is used only when no roster outlet on its side covered the story.

**Rules** (`news/cards.ts`, tested in `cards.test.ts`):

| Rule | Value |
| --- | --- |
| Opinion | dropped by feed choice, by URL (`/opinion/`, `/commentisfree/`, show blogs, per-outlet paths) and marked titles ("Opinion \|", "Analysis:", "Live updates"); outlets with no signal (HuffPost) count only when the check calls them news, so without an API key they are left out |
| Topic | a headline goes to the first `PAGE_TOPICS` entry its title matches, so a story is about one chart on one page; tariffs by the one trade partner named |
| Story | one topic within **3 days** of its first headline (`STORY_WINDOW_DAYS`), joined by other outlets' headlines that share 3+ detail words without the topic's words ("Supreme Court declines to halt DOJ deal…" on the deportation story) |
| Same development | the Claude API (`SOCIAL_NEWS_MODEL`, effort `SOCIAL_NEWS_EFFORT`) keeps the headlines that are straight news of one current national development with the topic central; it sees outlets and titles, never leans. Answers are cached by the story's set of URLs. Without a key: headlines must share 2 detail words with another outlet's, except periodic topics (a weekly price, a monthly report) |
| Chartless topics | page topics with no `chartId` (the last entries of `PAGE_TOPICS`): the page has no chart for the story (Fed rates, markets, budget, immigration court rulings, visas, enforcement, asylum, trade deals, shipping, emissions rules, oil markets, power sources, drilling). A charted topic wins a headline both match, and a headline already on a charted card is not repeated on a chartless one. The card has no chart link or sparkline; the story file omits `chartId` |
| Chart pick | a chartless story's check also gets the page's charts (`PAGE_CHARTS` in `topics.ts`, each with what it measures) and returns the one whose data directly measures what the story is about, or "none"; an id not on the list is ignored. The pick is saved with the check's answer (an answer from before the pick existed is asked again). `lib/news-derive.test.ts` checks `PAGE_CHARTS` against the pages' real card ids and that every chart has a topic or an entry in `CHARTS_WITHOUT_TOPIC` with the reason, so a new card fails the test until the news catalog knows it |
| Outlets | published with at least two outlets of any lean (loosened from "a left-of-center and a right-of-center outlet": too few stories otherwise, e.g. when a development reflects badly on one party); at most 3 headlines: the agency's release (else one more outlet), then one outlet per side, left, right, center, with any outlet filling a side nobody ran; per side, the outlet with the most headlines on the story, then roster order; the same wire headline never stands for two outlets |
| Release | the topic's agency item from 2 days before the first headline to 2 days after the last (Federal Register 7) |
| Page | earlier cards kept (the file is the memory); a card expires **14 days** after its date (`STORY_TTL_DAYS`); newest first; at most **6** cards, **2** per chart; `asOf` moves only when the cards change |

Locally: `pnpm news:pages -- --dry-run` (prints each page's cards), `-- --no-llm` for the word rules,
`--out DIR` to write elsewhere. Add a topic in `PAGE_TOPICS` (page, chart id, label, title pattern, release).

## Captions and the numbers check

Each insight carries **facts**: every number a caption may use, as text (`"$4.33 a gallon"`, `"12.4%"`), with the
exact rows it comes from (`energy_observations.json series_id=GASREGW, date=2026-10-12 → value`). `verify.ts`
re-derives each from the committed files; a draft that does not match is dropped.

The Claude API (`claude-sonnet-5-5`, effort `medium`; `SOCIAL_CAPTION_MODEL` / `SOCIAL_CAPTION_EFFORT` to change)
rewrites the template caption, and `checkCaption` enforces in code: every number is a fact's text; no spelled-out
quantities; no partisan or loaded words (`BANNED_WORDS`) or causal claims; no links, hashtags, mentions, emoji, "!"
or "?"; all earlier terms or none; "released" when the data is lagged; at most 240 characters. A failing caption is
retried with the reasons (three tries), then dropped. Without an API key the deterministic template is used.

## Why it moved: every post explains the change

Every data draft says why its number went up or down, and the Instagram carousel expands on it. Two parts:

**The reasons, researched** (`research.ts`). Before the caption is written, Claude (`claude-sonnet-5-5`, effort `medium`;
`SOCIAL_WHY_MODEL` / `SOCIAL_WHY_EFFORT`) opens the agency's own release for the period (`RELEASE_PAGES`: EIA's
Electricity Monthly Update, BEA and Census's trade release, CBP's encounter statistics, ...), then mainstream news
reporting of the same release (`NEWS_OUTLETS`: Bloomberg, CNBC, NPR, Axios, Fox Business and other outlets AllSides
rates Center, Lean Left or Lean Right; Reuters, AP, WSJ, NYT, MarketWatch, BBC and Politico block Anthropic's crawler) to corroborate it and add reasons the agency's write-up does not give. Agency write-ups
often lag or say little; a reason several outlets report is still a reason. Other sources on the FAQ list
(`pipeline/faq/sources.ts`: CRS/CBO/GAO, the Federal Reserve, universities) can add a forecast or a longer trend. The
web tools are limited to those sites. It returns one attributed sentence for the post (`caption_line`: "EIA cites
warmer weather ...") and one or two short paragraphs for a "Why it went up" slide, with every source. The slide text is
brief (`WHY_MAX` 380 characters) and reads as one connected account: it names no agency or outlet (the post sentence
does; the slide's footnote lists each source once, "BEA; CNBC; The Hill"), and a reason that comes from reporting is
worded "amid" or "tied to", not as the site's own conclusion. Code then checks:

- each source is an allowed agency site or a news report from `NEWS_OUTLETS` (never an opinion page), **and** is a page
  the model opened or found in that request (no made-up citations);
- news is corroborated: a why that cites news lists at least two different outlets in its sources;
- the post sentence names its source and uses no causal phrase from `CAUSAL_PHRASES` ("cites", "reports", not "due to");
- the paragraphs carry no figures but years (the numbers are on the breakdown slide, where they are verified), name no
  agency or outlet, say no "because of" or "driven by" in the site's own voice, fit the slide (`WHY_MAX`), and pass the
  FAQ neutrality rules (`neutralityProblem`: no loaded words, parties or politicians,
  and no sentence pairing a cause word with a policy word).

A failing answer is retried with the reasons; after three tries the draft opens without one and says so in the issue.
The caption writer then puts the why second, after the data sentence, still under 240 characters and still checked by
`checkCaption`. Each draft issue shows the why and links every source, to check before approving. `why.ts` holds
hand-written reasons that replace the research for a given draft. News drafts keep their own caption rules and get none.

**The drivers, from the data** (`breakdown.ts`). Where the data splits the change into parts, a breakdown slide shows
each part's change as bars, every value a verified fact (so captions may cite them too):

| Series | Breakdown |
| --- | --- |
| Total electricity generation | each source (gas, solar, wind, nuclear, coal): the month against a year earlier, and 12 months against the 12 before |
| Goods trade deficit, imports, exports | the 5 partners whose part changed most: the month against a year earlier, and the year to date against the same months a year earlier (not seasonally adjusted) |

Gas prices, encounters, ICE, executive orders and laws have no breakdown in the data, so they get the why slide only.

## Long-form threads on X and Bluesky

`thread.ts`, `thread-charts.tsx`. A data draft posts as a thread: the caption and chart card first (as before), then
replies. **Text is text and only charts are images**: the reasons, the key moments and the definition are plain posts, and
each block of "What drove it" is a chart card. The same texts go to both platforms (written to 280 characters, X's limit).
News drafts and the intro are not threads; a draft with nothing to add posts as one post.

| Reply | What | When |
| --- | --- | --- |
| Why it went up | the researched paragraphs (`research.ts`) packed into posts, kept whole, split between sentences if long | the research found a reason (a "What changed" answer is left out and noted in the issue) |
| What drove it | one post and one 1200×675 chart card per breakdown block: a line of signed changes, then bars (`breakdown.ts`) | the series has a breakdown (total electricity, goods trade) |
| Key moments | dated actions from the site's sourced timelines (`moments.ts`), "listed for context, not as causes" | a line chart whose series has a timeline |
| What this measures | the series definition (`explain.ts`) | no reason and no breakdown |
| Sources | the data source and the pages the reasons came from (news by outlet name, never by headline) | always, last; the link is added to it (X: only with `X_INCLUDE_LINK=true`) |

Every reply is built from something already checked, and `checkReplies` runs the plain rules again on the stored text
before posting: at most 280 characters, no links, hashtags, mentions, emoji, "!" or "?", no loaded or partisan words, and
no number that is not a fact, a year, or one the thread was generated with (`reply_numbers`), so editing a reply cannot add
a figure. The caption check is unchanged. The issue's Thread section shows each reply and chart, and the Length section
their lengths on each platform.

**Reviewing and editing.** Approving the issue approves the whole thread. To change a reply, edit `replies` in the hidden
block (the chart post is still `caption`).

**Posting.** `post-next.ts` posts the parts in order, each a reply to the one before (Bluesky `reply.root`/`parent`, X
`in_reply_to_tweet_id`). Each part posted is recorded as a hidden comment on the issue (`<!-- social-thread … -->`), so a
thread that stops halfway resumes at the next slot from the part it was on instead of repeating the earlier ones. Lengths
(with the link on the last post) are checked before anything is posted. X costs more for a post with a URL, so the thread's
link is one URL on its last post, the same $0.20 a single post with a link costs; a thread is about five times the
per-post cost without it (check X's current prices).

Instagram keeps its own text slides (`carousel.tsx`): a slide is the only way to post text there.

## Instagram (posted by hand)

There is no Instagram poster: Meta disabled the first account within hours, so Instagram is posted by hand from a new
account until it has a normal history. Each draft issue's Length section also gives the **Instagram text** to paste
(`instagram.ts`): the checked caption, "Chart and full data at insidegov.fyi/… (link in bio)" (Instagram captions
cannot hold a link), and the dataset's fixed hashtags. It is rebuilt with the rest of the section when the caption is
edited.

**Slides.** Each draft also gets a 4:5 carousel (`carousel.tsx`), shown in its issue as thumbnails that link to the
full 1080×1350 images, to save and upload in order. The slides go to the `social-drafts` branch with the chart.

| Slide | What | When |
| --- | --- | --- |
| Hook | the newest value (a caption fact) large, the headline, a small trend line | always |
| Chart | the draft's chart redrawn for the portrait frame (term band, marks, source) | always |
| Why it went up | the researched reasons and their sources (`research.ts`, or `why.ts` by hand) | the draft has a why |
| What drove it | each source's or partner's change, as bars (`breakdown.ts`) | the series has a breakdown |
| How to read this | what the series measures, from `explain.ts`: plain definitions, no numbers, no causes | the series has an entry, and the draft has neither of the two above |
| Key moments | dated actions from the site's sourced timelines (`energy_actions.json`, `tariff_actions.json`) between the chart's first date and the draft, at most 4, then the latest reading; a note says they are listed in order, not as causes | a line chart whose series has a timeline (energy series, news tariff charts) |
| End | the page, "Link in bio", the source | always |

**The intro.** `pnpm insights:intro -- --instagram DIR` writes the account's first post: six slides drawn from the
About page (cover with ten-year trend lines from real series, why it exists, questions it answers, what the account
posts, what the charts do and don't, and a personal "Who's behind it" slide for people who knew the original
InsideGov at Graphiq) and `intro-caption.txt`. The words are in `introCarousel()` in `intro.ts`; keep them in step with
`app/about/page.tsx`.

Slides are laid out on a 720×900 canvas and scaled 1.5× in the renderer, so the chart code's label sizes read at
phone size. `chart.tsx` draws in a `Frame` (the card's 1200×675 or the slide's portrait frame); the card is unchanged.

**To the phone.** Instagram is posted from the phone, so `pnpm insights:slides -- --issue N` pulls an approved draft's
slides (the issue's own images) and its Instagram text into `InsideGov Instagram/<date> <draft>/` in the Google Drive
folder that Google Drive for desktop syncs (`~/Library/CloudStorage/GoogleDrive-*/My Drive`), as `slide-1.png` … and
`caption.txt`; the Drive app on the phone has them a minute later. `-- --intro` renders the account intro the same way
into `intro/`. Without Drive installed it saves to `~/Downloads/InsideGov Instagram` and says so; `--out DIR` or
`INSTAGRAM_OUT_DIR` picks another folder. A draft made before carousels has no slides, and the command says that.

**Automatically, when you approve.** GitHub's servers cannot write to a folder on your Mac, so a small launchd job on the
Mac does it: `scripts/install-instagram-sync.sh` (run once, from a checkout on main) makes a private checkout of main at
`~/.insidegov-instagram-sync`, installs its packages, and registers an agent that runs `scripts/instagram-sync.sh` at login
and every five minutes. Each run updates that checkout to main and runs `pnpm insights:slides -- --approved`: every issue
labelled `social-approved` (open or closed, since posting closes it) in the last 7 days, not expired and not fetched
before, gets its folder in Drive. Fetched issue numbers are kept in `~/.cache/insidegov-instagram-sync.json`. It needs the
Mac on and `gh` signed in; a missed run is made up at the next. It costs nothing: GitHub's API (a handful of calls an
hour), no Claude calls, and the files count toward the Google account's storage. Log: `~/Library/Logs/insidegov-instagram-sync.log`.
`scripts/uninstall-instagram-sync.sh` removes it.

**Hashtags are written by code, never by the model.** `INSTAGRAM_HASHTAGS` holds 3 to 5 plain topic tags per dataset
(Instagram caps a post at 5), all ending in `#govdata`, and `SERIES_HASHTAGS` overrides them for a series whose
dataset's set would be off topic (an electricity chart gets `#electricity #naturalgas #solarenergy`, not `#oil`); `checkCaption` still rejects any caption containing "#", so the
model cannot add one, and X and Bluesky stay hashtag-free. No party, person or campaign tags; a test checks each set.

## Notifications

- **Email**: each freshness run that opens drafts sends **one** email (not one per draft) listing them with links and a
  link to the review queue. It uses the same `NOTIFY_*` secrets as the data-check alerts (email, Slack as fallback; see
  `docs/DATA_CONVENTIONS.md`, "Review notifications"), so with those set there is nothing more to configure.
- **Posting results**: `social-post.yml` sends one email when a run posts something (with the links), when a post fails
  (which platform and the error; it retries next slot), when a due draft's caption fails the check, or when a draft
  expires unposted. Quiet runs, and dry runs, send nothing.
- **GitHub's own** issue emails still apply if you watch the repository.
- Each draft issue has a **Length** section: characters used against Bluesky's 300 and X's 280 (X without and with the
  link), and whether the caption still passes the check. Editing the issue refreshes it automatically
  (`social-counts.yml`).

## Chart titles and data notes (a standing rule)

Every chart the pipeline draws follows one convention, set in `title.ts` and enforced in three places:

- **The title is what a reader would call the chart**, in plain words, then what it spans: "Inflation, 2016 to 2026",
  "Jobs added each month, 2021 to 2026", "The federal deficit by fiscal year", "U.S. electricity generation each August",
  "Tariffs on Canada vs. all countries". Never method: no "nonfarm", "seasonally adjusted", "real", "from a year earlier",
  "with a surplus shown as negative", no parentheses or colons.
- **Method and fine print are data notes**, printed beside the source at the bottom left ("Source: Bureau of Labor
  Statistics, via FRED · Nonfarm payrolls · Seasonally adjusted"). They live in `Series.note` (separate notes joined with
  " · "). The axis label is the unit and nothing else.
- **Each series has a plain `title`** (`Series.title`, `EventSet.title`), separate from `name`, which is the caption's
  noun phrase. `chartTitle()` builds the drawn title from it (a line gets its range, bars what each bar is).

How it is enforced: `Insight.title` is a required field, so a new chart generator does not compile without one;
`chart.tsx` and `carousel.tsx` draw `title`, never `headline` (the issue's descriptive line); `buildDrafts` drops a draft
whose title or axis label breaks the rule; and `title.test.ts` runs every generator on the real data (every series, every
insight kind, the tariff charts) and checks each title, axis label and note. To add a series, give it a `title` and put its
method in `note`; the tests say what to fix.

## The chart image

`chart.tsx` draws a 1200 × 675 card with `next/og`, the site's seal (`app/icon.svg`) and wordmark on top. Line charts (the usual card) carry the site's presidential-term band
under the year axis: the same light party tint, party-coloured top rule and shortened names as the Energy and Trade
pages (ARCHITECTURE_MAP rule 10b, `lib/term-label.ts`), from `administrations.json` plus Bush 41. The line, the dots and
the newest-value accent stay neutral. Bar cards (a fiscal-year series, a term comparison) have no band: a term comparison
already labels one bar per president.

## Reviewing

Each draft issue shows the image, the exact post text, the freshness window ("queue it by …"), and every fact with its
rows. **Approve**: label `social-approved` (queues it; it posts at the next free slot). **Reject**: close it. To change
the wording, edit `caption` in the hidden `<!-- social-draft … -->` block; it is re-checked before posting. GitHub
notifies you of new draft issues if you watch the repository (All Activity, or Custom → Issues).

## Setting up the accounts

You create the accounts and the credentials; the code never signs up for anything. Order:

1. **Merge this, then open the intro issue**: `pnpm insights:intro` (or edit `INTRO_THREAD` in `intro.ts` first).
   Label it `social-approved` when happy. It posts first on each platform; on Bluesky it is pinned automatically,
   on X pin it by hand (no API for that).
2. **Bluesky** (free):
   - Create the account at bsky.app. For the handle, use the domain: Settings → Account → Handle → "I have my own
     domain" → add the TXT record it shows to insidegov.fyi's DNS, and the handle becomes `@insidegov.fyi` (verified by
     the domain itself).
   - Settings → Privacy and security → App passwords → add one named "GitHub Actions".
   - Repo secrets: `BLUESKY_HANDLE` (`insidegov.fyi`) and `BLUESKY_APP_PASSWORD`.
3. **X** (paid per use):
   - Create the account at x.com, then sign in to the X developer portal (developer.x.com) with it.
   - Create an app; under User authentication settings set permissions to **Read and write**. Then generate the
     **API key and secret** and the **access token and secret** for the account (OAuth 1.0a; regenerate the access
     token after changing permissions). Add a payment method: X bills per request (pay-per-use since 2026). At the
     time of writing a post costs about $0.015, but **$0.20 if its text contains a link**, so chart posts go out
     without the link by default (the chart shows the page address); set the repo variable `X_INCLUDE_LINK=true` to
     include it. At ~20 posts a month that is well under $1 a month without links. Check the developer portal for current prices.
   - Repo secrets: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`.
4. **Dry run**: Actions → "Social post (scheduled, disabled)" → Run workflow with dry run ticked. The log shows what it
   would post.
5. **Turn it on**: repo variable `SOCIAL_POSTING_ENABLED` = `true`. The next weekday slot posts the intro thread; drafts
   follow as data comes out and you approve them. Delete the variable to stop.
6. **News drafts** (optional): repo variable `SOCIAL_NEWS_ENABLED` = `true` starts the hourly news watcher. It only
   drafts; posting still needs `SOCIAL_POSTING_ENABLED` and your approval. `ANTHROPIC_API_KEY` (already a secret for
   captions) turns on the Claude check.

A platform with no secrets is simply skipped, so you can start with Bluesky alone.

## Commands

```bash
pnpm insights:plan                           # the posting plan from tomorrow, 28 days -> social-drafts/plan.md
pnpm insights:plan -- --draft                # ... and caption + render the drafts that are ready now
pnpm insights:backfill                       # replay the last 6 months: schedule.md + the last 50 posts as drafts
pnpm insights:backfill -- --no-llm           # same, template captions, no API calls
pnpm insights:draft -- --datasets energy --since-ref HEAD     # what the working tree adds over HEAD (the workflow step)
pnpm insights:issues -- --dir social-drafts/latest --dry-run  # print the issues that would be opened
pnpm insights:post -- --slot morning --dry-run                # what the scheduler would do at the next morning slot
pnpm insights:intro -- --print               # the intro thread
pnpm insights:news                           # the news watcher once: stories in the news -> social-drafts/news
pnpm insights:news -- --no-llm               # ... keyword rules only, template captions
pnpm insights:post -- --slot news --dry-run  # what the news lane would post now
pnpm news:pages -- --dry-run                 # the pages' In the news cards, printed (no files written)
```

`social-drafts/` is git-ignored. Captions need `ANTHROPIC_API_KEY` (env or `.env.local`).

## In the workflows

The six freshness workflows run `.github/actions/social-drafts` after their transform and before opening the data PR
(`continue-on-error`, so it can never block a refresh). HEAD still holds the old data then, so "new" means newer than
HEAD, and the run date is the release date. Each run drafts at most 3 per dataset. Images go to the orphan
`social-drafts` branch and are embedded from raw.githubusercontent.com; an issue is skipped if one already exists for
the same draft. Tick **social_dry_run** on a manual run to print the issues instead. `social-drafts.yml` drafts from
main's data after a chosen date (release dates estimated), dry run by default.

**A missed draft is caught the next morning.** The freshness workflows draft once, at the moment a refresh lands; if
that step breaks, or the refresh is merged by hand after a failed gate, the next run finds nothing new and nothing
retries. `social-catchup.yml` runs daily at 14:07 UTC (7:07 a.m. Pacific) from the data on main: it drafts every insight
still inside its freshness window that has no `social-draft` issue yet, open or closed (so a rejected draft stays
rejected, and nothing older than an already-drafted newer reading of the same series is revived), at most 6 a run, with
the same issues and one email as any other drafting run. A normal day drafts nothing and makes no Claude calls. Locally:
`pnpm insights:draft -- --datasets energy --since 2026-06-01 --fresh --exclude-file ids.txt`.

**A broken drafting step is announced.** `continue-on-error` hides a failure, so each freshness workflow has an
"Email if drafting failed" step (the drafting action's own email cannot send when the action itself failed to load),
and the catch-up emails if it fails. `pipeline/workflows.test.ts` (run by CI) parses every workflow and action file,
checks that local actions exist and `steps.<id>` references resolve, and fails if a drafting step that can fail silently
has no such email step.
