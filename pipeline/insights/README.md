# pipeline/insights/ — social posts

Turns new government data into social posts: one chart image, a one- or two-sentence caption, a link to the page.
Because the content is political, **a person approves every post**. Posts follow the data: something is posted because
data just came out, at a steady pace, never in bursts. Bluesky and X are supported; both are off until set up.

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
two weekday slots and posts at most one draft per slot:

| Rule | Value |
| --- | --- |
| Slots | Mon–Fri **9:00 a.m. Pacific (noon Eastern)**: working hours on both coasts, after the morning releases. A second slot at **1:00 p.m. Pacific (4:00 p.m. Eastern)** runs only when 3+ drafts are waiting. No weekend posts. Slots are fixed in Pacific time through daylight saving (the workflow's UTC cron fires at both possible hours and `slotAt` keeps the right one). Change `SLOTS` / `TIME_ZONE` in `schedule.ts` to move them. |
| Caps | 2 a day, 8 in any 7 days, at least 4 hours apart. |
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

## Captions and the numbers check

Each insight carries **facts**: every number a caption may use, as text (`"$4.33 a gallon"`, `"12.4%"`), with the
exact rows it comes from (`energy_observations.json series_id=GASREGW, date=2026-10-12 → value`). `verify.ts`
re-derives each from the committed files; a draft that does not match is dropped.

The Claude API (`claude-opus-5-5`, effort `medium`; `SOCIAL_CAPTION_MODEL` / `SOCIAL_CAPTION_EFFORT` to change)
rewrites the template caption, and `checkCaption` enforces in code: every number is a fact's text; no spelled-out
quantities; no partisan or loaded words (`BANNED_WORDS`) or causal claims; no links, hashtags, mentions, emoji, "!"
or "?"; all earlier terms or none; "released" when the data is lagged; at most 240 characters. A failing caption is
retried with the reasons (three tries), then dropped. Without an API key the deterministic template is used.

## Notifications

- **Email**: each freshness run that opens drafts sends **one** email (not one per draft) listing them with links and a
  link to the review queue. It uses the same `NOTIFY_*` secrets as the data-check alerts (email, Slack as fallback; see
  `docs/DATA_CONVENTIONS.md`, "Review notifications"), so with those set there is nothing more to configure.
- **GitHub's own** issue emails still apply if you watch the repository.
- Each draft issue has a **Length** section: characters used against Bluesky's 300 and X's 280 (X without and with the
  link), and whether the caption still passes the check. Editing the issue refreshes it automatically
  (`social-counts.yml`).

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
```

`social-drafts/` is git-ignored. Captions need `ANTHROPIC_API_KEY` (env or `.env.local`).

## In the workflows

The six freshness workflows run `.github/actions/social-drafts` after their transform and before opening the data PR
(`continue-on-error`, so it can never block a refresh). HEAD still holds the old data then, so "new" means newer than
HEAD, and the run date is the release date. Each run drafts at most 3 per dataset. Images go to the orphan
`social-drafts` branch and are embedded from raw.githubusercontent.com; an issue is skipped if one already exists for
the same draft. Tick **social_dry_run** on a manual run to print the issues instead. `social-drafts.yml` drafts from
main's data after a chosen date (release dates estimated), dry run by default.
