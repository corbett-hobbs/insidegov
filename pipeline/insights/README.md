# pipeline/insights/ — social posts

Turns new government data into social posts: one chart image, a one- or two-sentence caption, a link to the page,
and a 4:5 Instagram carousel posted by hand.
Because the content is political, **a person approves every post**. Posts follow the data: something is posted because
data just came out, at a steady pace, never in bursts, **or because a topic the site has data on is in the news**
(see "News drafts" below): a chart of diesel prices when diesel is in the headlines, the tariff rate collected on
Canada when tariffs on Canada are. Bluesky and X are supported; both are off until set up.

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
       news/watch.ts      read the feeds                                 news/feeds.ts
                          find topics in the news (2+ publishers)        news/match.ts, news/topics.ts
                          is it a real, current story?  (Claude API)     news/classify.ts
                          context chart from data the site has           news/charts.ts
                          verify, caption, render: as above
       open-issues.ts     `social-draft` + `social-news` issue, one email
you: label `social-approved`  →  posts within minutes (no slot)        post-next.ts --slot news → schedule.ts pickNews
```

## What becomes a post

Detectors (`detect.ts`, pure, tested) look only at the **newest** observation of a series:

| Kind | Rule |
| --- | --- |
| New high / low | Highest (lowest) since a value at least that extreme, at least 3 years earlier; or beyond everything in at least 5 years of data ("in data going back to …", never "record"). Seasonal series (electricity, gas production, LNG, laws by month) compare like months. Records in a steadily growing series (solar) are scored down. |
| Biggest move | The newest one-period change (week, month, fiscal year; year over year for seasonal series) is the largest in its direction in 3 years, and at least 1%. |
| Same point in term | The current presidential term against every earlier term at the same elapsed time. **Quarterly** (March, June, September, December data), not every refresh. Needs at least three terms; the caption names all earlier terms or none; terms are never coloured by party. |
| Latest reading | The routine post for each dataset's headline series (gas price, crude output, electricity, trade deficit, southwest border encounters, executive orders and laws per month): the newest value, its change on the period and on the year. Only when the same refresh produced nothing notable for that series, so every update has something to post but nothing posts twice. |

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
| Slots | Mon–Fri **9:00 a.m. Pacific (noon Eastern)**: working hours on both coasts, after the morning releases. A second slot at **1:00 p.m. Pacific (4:00 p.m. Eastern)** runs only when 3+ drafts are waiting, or on the day the intro posts (so the first chart follows it). No weekend posts. Each slot is a window (9–1 and 1–5 Pacific): GitHub starts scheduled runs hours late or drops them, so the workflow fires every half hour through both windows and the first run with something to post uses the slot. Slots stay fixed in Pacific time through daylight saving (the UTC cron covers both seasons and `slotAt` drops runs outside the windows). Change `SLOTS` / `TIME_ZONE` in `schedule.ts` to move them. |
| Caps | 2 a day, 8 in any 7 days, at least 3 hours apart. |
| Topic mix | A topic (energy, gas, trade, encounters, ICE, executive orders, laws) posts at most twice in 7 days, and one that posted in the last 36 hours waits if anything else is ready. |
| Order | The intro thread first. Then notability × urgency (closer to going stale = sooner) × rotation (topics not seen for a while first). |

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
| Gas and diesel prices (EIA via FRED) | weekly, Monday's survey out Monday afternoon | `indicators-freshness` (Mondays 11:43 UTC, so it posts the previous week's price) | latest reading weekly; new highs/lows and big weekly moves |
| Strategic Petroleum Reserve (EIA WPSR) | weekly, Wednesdays | `energy-freshness` (Tuesdays) | lows, big weekly draws |
| EIA monthly energy (oil output and trade, natural gas, LNG, electricity by source) | monthly, late in the month, 2–3 months back | `energy-freshness` | highs/lows for the month, usually with the "newly released" label |
| Goods trade (Census) | monthly, about 5 weeks after the month | `trade-freshness` (Wednesdays) | deficit reading or a high/low; term comparison quarterly |
| CBP border encounters | monthly, mid-month; fiscal year in October | `encounters-freshness` (Wednesdays) | monthly reading or a high/low; fiscal-year totals |
| Executive orders, laws | continuously | `executive-orders-freshness`, `laws-freshness` (Mondays) | after each month: the month's count (or a new high); quarterly term comparison |
| ICE removals and detention | yearly, curated by hand | no freshness workflow: run `social-drafts.yml` after updating | yearly figures |

## News drafts: posting when a topic is in the news

`news/`. The data calendar decides most posts, but a chart is most useful the day its topic is in the news: tariffs on
Canada announced, a diesel deal with Russia. The news watcher listens for that and drafts a **context chart** from
data the site already has. It does not report the news, it gives it background.

**Topics** (`news/topics.ts`, `NEWS_TOPICS`): only topics the site can chart. Add one there (title pattern, chart, lead).

| Topic | Headline mentions | Chart |
| --- | --- | --- |
| Tariffs | "tariff(s)" (not utility rates); a big trade partner by name or demonym | the tariff rate collected on that partner against all countries, monthly, 10 years (or all countries alone) |
| Diesel | "diesel" | weekly diesel price, 10 years, with its high |
| Gas prices | "gas prices", "price of gasoline", "at the pump" | weekly regular gasoline price, 10 years, with its high |
| SPR | "Strategic Petroleum Reserve" | weekly SPR level, 15 years, with its high |
| Oil production | "U.S. oil production/output" | monthly crude production, 10 years, with its high |
| LNG | "LNG", "liquefied natural gas" | monthly LNG exports, same month each year (the July peak for July data) |
| Trade deficit | "trade deficit/gap/balance" | monthly goods deficit, 10 years, with its high |
| Border | "border crossings/encounters/apprehensions" | monthly southwest border encounters, 10 years, with its high |
| Deportations | "deportation(s)", "deported" | ICE removals by fiscal year |

**The comparison point** is the peak in the chart's window, and how far back that peak stands in all the data
("down from a peak of $6.53 a gallon in September 2026, the highest in data going back to 1994"; for a country's
tariff rate, "The peak for Canada was 3.8% in September 2025", so it cannot be read as the all-countries rate). A year
earlier is the fallback, when the latest value is itself the peak ("up 19% from a year earlier, the highest July in
data going back to 1997"). Clauses are dropped from the end until the caption fits 240 characters.

**Feeds** (`news/feeds.ts`, `news/outlets.ts`), plain RSS, no keys: the White House's presidential actions feed
(official, public domain: proclamations and executive orders, such as tariff changes) and the news outlets' own feeds
(the roster under "In the news on the pages" below; the end reserves are not read here), opinion filtered out. Set the
repo variable `SOCIAL_NEWS_SOURCES=whitehouse` to use the official feed only (`outlets` for the outlets only; the old
value `google` means `outlets`). Google News searches were used before (its feed terms limit it to personal,
non-commercial use) and GDELT's free API before that (it rate-limits GitHub's shared runners).

**What counts as a story** (`news/match.ts`, tested):

| Rule | Value |
| --- | --- |
| Recency | headlines from the last **6 hours** (`NEWS_LOOKBACK_HOURS`) |
| Corroboration | **2+ different outlets** (`NEWS_MIN_SOURCES`), or one official White House document |
| Tariffs | a headline naming exactly one trade partner importing $2B+ a year is that partner's story; none or several, the all-countries story, which ranks after any partner's |
| Relevance | with `ANTHROPIC_API_KEY`, the Claude API (`claude-haiku-5-5`, effort `low`; `SOCIAL_NEWS_MODEL` / `SOCIAL_NEWS_EFFORT`) answers yes or no: a current, national development with the topic central, not opinion, local or company news. A "no" is remembered for **6 hours** (`news/state.json` on the `social-drafts` branch) so the same story is not asked about every run. Without a key, the keyword and publisher rules stand alone. |
| Volume | at most **2 drafts a run**, one per topic; the same topic (and partner) at most once in **3 days** (`NEWS_COOLDOWN_DAYS`) |

**The link** goes to the chart's own card, with its filter: `/presidency/trade?country=CAN#tariffs` for a country's
tariffs, `/presidency/economy#gas-price`, `/presidency/energy#spr`. Each series' `anchor` (datasets.ts) names the card;
data-release drafts use it too. Card ids are the ones the share button gives (the title slugged, components/charts/ChartShare.tsx),
except the trade balance and tariff cards, which set fixed ids (`trade-balance`, `tariffs`) because their titles
change with the country. Rename a card and its anchor here must follow.

**The caption** opens with a fixed sentence written by code ("Diesel is in the news.", "Tariffs involving Canada are
in the news.") and then says only what the data shows. The caption check rejects a caption that changes the opening,
and the usual rules apply: every number is a fact from the data (so no rate or figure from a headline can get in),
no loaded words, no causes. The model is told never to describe the news (who announced what, terms, reactions). The
headlines are listed in the issue for the reviewer and are never posted. The tariff chart's context note says the
collected rate is not an announced rate and moves months after a change.

**Speed.** News goes stale in hours, so news drafts skip the weekday slots:

| Rule | Value |
| --- | --- |
| Watch | hourly, around the clock, once the repo variable `SOCIAL_NEWS_ENABLED=true` |
| Notify | one email per run that opens drafts ("news draft to approve"), same `NOTIFY_*` secrets |
| Post | approving (label `social-approved`) triggers the news lane at once, and it also runs after every watch: it posts within minutes, any day or hour (a person approved it) |
| Expiry | **24 hours** after the story was first seen (`NEWS_FRESH_HOURS`); then it is closed as `social-expired` |
| Caps | **2 news posts a day** (`NEWS_MAX_PER_DAY`), **4 posts a day** with data posts (`MAX_TOTAL_PER_DAY`), **45 minutes** after any post (`NEWS_MIN_MINUTES_BETWEEN`); a held post goes out at the next clear run |
| Data slots | ignore news drafts; news posts do not use up the data caps, but a data slot waits 45 minutes after a news post, and topic rotation counts them (a diesel news post holds back a gas-price data post for 36 hours) |

To try it: Actions → "Social news watcher" → Run workflow (dry run ticked prints the drafts). Locally:
`pnpm insights:news` (writes `social-drafts/news/`), `-- --no-llm` for keyword rules and template captions.

## In the news on the pages

`news/pages.ts`. Each data page ends with an "In the news" row: one card per story, showing how a left-of-center and a
right-of-center outlet headlined it, beside the agency's own release (or a Center outlet) and the chart it is about,
so readers judge the framing themselves. The pipeline writes `pipeline/output/news_<page>.json` (economy, immigration,
trade, energy) in the UI's schema (`lib/news-types.ts`: `{ asOf, stories: [{ id, date, topic, chartId, headlines:
[{ outletId, outlet, lean, title, url }] }] }`).

```
four times a day (.github/workflows/news-pages.yml, repo variable NEWS_PAGES_ENABLED=true)
  news/pages.ts   read the outlets' and agencies' feeds                  news/feeds.ts, news/outlets.ts
                  + the topic headlines earlier runs saw (Actions cache)
                  one topic per headline, one chart per topic             news/topics.ts PAGE_TOPICS
                  group into stories, add same-story companions           news/cards.ts
                  which are straight news of one development? (Claude)    news/classify.ts checkCandidate
                  balance rule, data release, merge with earlier cards    news/cards.ts
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
| Balance | published only with a left-of-center **and** a right-of-center outlet; at most 3 headlines: the agency's release (else a Center outlet), the left and the right; per side, the outlet with the most headlines on the story, then roster order; the same wire headline never stands for both sides |
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
reporting of the same release (`NEWS_OUTLETS`: Reuters, AP, Bloomberg, WSJ, CNBC and other outlets AllSides rates
Center, Lean Left or Lean Right) to corroborate it and add reasons the agency's write-up does not give. Agency write-ups
often lag or say little; a reason several outlets report is still a reason. Other sources on the FAQ list
(`pipeline/faq/sources.ts`: CRS/CBO/GAO, the Federal Reserve, universities) can add a forecast or a longer trend. The
web tools are limited to those sites. It returns one attributed sentence for the post (`caption_line`: "EIA cites
warmer weather ...") and two to four paragraphs for a "Why it went up" slide, with every source. Code then checks:

- each source is an allowed agency site or a news report from `NEWS_OUTLETS` (never an opinion page), **and** is a page
  the model opened or found in that request (no made-up citations);
- news is corroborated: a why that cites news cites at least two different outlets, and names them ("Reuters and
  Bloomberg report ...");
- the post sentence names its source and uses no causal phrase from `CAUSAL_PHRASES` ("cites", "reports", not "due to");
- the paragraphs carry no figures but years (the numbers are on the breakdown slide, where they are verified), fit one
  slide (`WHY_MAX`), and pass the FAQ neutrality rules (`neutralityProblem`: no loaded words, parties or politicians,
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
6. **News drafts** (optional): repo variable `SOCIAL_NEWS_ENABLED` = `true` starts the 15-minute news watcher. It only
   drafts; posting still needs `SOCIAL_POSTING_ENABLED` and your approval. `ANTHROPIC_API_KEY` (already a secret for
   captions) turns on the relevance check.

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
