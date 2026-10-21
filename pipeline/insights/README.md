# pipeline/insights/ — social post drafts

Turns new data in `pipeline/output/` into **drafts** of social posts: one chart image, a one- or two-sentence caption,
and a link to the page. Because the content is political, **nothing posts automatically**: every draft becomes a GitHub
issue, and a person approves it. Bluesky is the first target; its poster is written but disabled.

```
data refresh (freshness workflow)
  └─ .github/actions/social-drafts
       ├─ run.ts         detect insights in what the refresh added  (detect.ts, collect.ts)
       │                 verify every fact against its data cells    (verify.ts)
       │                 caption with the Claude API, checked in code (caption.ts)
       │                 render the chart                             (chart.tsx)
       ├─ images         push the PNGs to the `social-drafts` branch
       └─ open-issues.ts one `social-draft` issue per draft          (issue.ts)
human: label `social-approved` (or close to reject)
  └─ .github/workflows/social-post.yml  → bluesky.ts   DISABLED until SOCIAL_POSTING_ENABLED=true
```

## What counts as an insight

All detectors look only at the **newest** observation of a series (a series is cut at a date first, so "what was
notable when this month landed"). Pure functions in `detect.ts`, tested in `insights.test.ts`.

| Kind | Rule |
| --- | --- |
| New high / low | The newest value is the highest (lowest) since a value at least that high, at least `MIN_YEARS` (3) earlier; or beyond everything in at least `MIN_RECORD_YEARS` (5) of data, said as "in data going back to …" (never "record"). Seasonal series (electricity, gas production, LNG, laws by month) compare a month only with the same calendar month. A record right after another record (a steadily growing series like solar) is scored down. |
| Biggest move | The newest one-period change (week, month, fiscal year; year over year for seasonal series) is the largest in its direction in `MIN_YEARS`, and at least 1%. |
| Same point in term | The current presidential term against every earlier term at the same elapsed time: a level (gas price, SPR, oil output) as the % change from inauguration to the same day; a flow (trade, encounters) summed over the same full months; records (executive orders, laws) counted over the same days. Needs **at least three terms** with data (never a two-way chart), and the chart and caption describe all terms, not a chosen one. Terms are never coloured by party. |

Datasets (`datasets.ts`): EIA energy (`energy`), EIA gas and diesel prices via FRED (`gas`), CBP encounters monthly and by
fiscal year (`encounters`), ICE removals and detention (`ice`), Census goods trade (`trade`), executive orders, laws.
Freshness workflows hooked up: energy, indicators (gas), encounters, trade, executive orders, laws. ICE has no freshness
workflow (its data is curated by hand from annual reports), so ICE insights come from the backfill or the manual workflow.

## Captions and the numbers check

Each insight carries **facts**: every number a caption may use, as text (`"$4.33 a gallon"`, `"12.4%"`,
`"August 2026"`), with a derivation that names the exact rows it comes from (`energy_observations.json
series_id=GASREGW, date=2026-10-12 → value`). `verify.ts` re-reads those rows from the committed files, re-derives each
value and re-formats it; a draft whose facts do not match is dropped.

The Claude API (`claude-opus-5-5`, effort `medium`; override with `SOCIAL_CAPTION_MODEL` / `SOCIAL_CAPTION_EFFORT`)
rewrites the insight's template caption. `checkCaption` then enforces, in code:

- every number in the caption is the text of a fact (so no re-rounding, no arithmetic, no outside numbers);
- no spelled-out quantities ("doubled", "half", "three");
- no partisan or loaded words (`BANNED_WORDS`: party names, "surge", "plunge", "crisis", "record", …), no causal claims
  ("because of", "due to", "thanks to"), no links, hashtags, mentions, emoji, "!" or "?";
- a term comparison names all earlier terms or none;
- at most 240 characters (the link is appended; Bluesky allows 300).

A caption that fails is asked again with the reasons (three tries), then the draft is dropped. Without an API key, or
with `--no-llm`, the deterministic template is used (it passes the same check).

## Commands

```bash
pnpm insights:backfill                       # last 6 months of every dataset → social-drafts/backfill/ (open index.html)
pnpm insights:backfill -- --no-llm           # same, template captions, no API calls
pnpm insights:draft -- --datasets energy --since-ref HEAD     # what the working tree adds over HEAD (the workflow step)
pnpm insights:draft -- --datasets gas,trade --since 2026-09-01
pnpm insights:issues -- --dir social-drafts/latest --dry-run  # print the issues that would be opened
pnpm insights:post -- --issue 123            # dry run unless posting is enabled (below)
```

`social-drafts/` is git-ignored. Captions need `ANTHROPIC_API_KEY` (env or `.env.local`).

## In the workflows

The six freshness workflows run `.github/actions/social-drafts` after their transform and before opening the data PR
(`continue-on-error`, so it can never block a refresh). HEAD still holds the old data then, so "new" means newer than
HEAD. Each run picks at most 3 drafts per dataset, one per series and kind. Term comparisons repeat monthly at most:
weekly series compare terms only on the first week of a month, executive orders and laws only at month ends.

Images go to the orphan branch `social-drafts` (`images/<slug>.png`) and are embedded from raw.githubusercontent.com. An
issue is skipped if one already exists for the same draft id (open or closed, so a rejected draft stays rejected).

Dry run: run any of those workflows by hand with **social_dry_run** ticked; the step prints each issue body instead of
opening it and pushes no images. `Social drafts (manual)` (`social-drafts.yml`) drafts from main's data after a chosen date,
dry run by default.

## Reviewing a draft issue

The issue shows the image, the exact post text, and (folded) every fact with the rows it comes from. Check the chart,
the wording and whether it is worth posting. **Approve** by adding the `social-approved` label; **reject** by closing.
To change the wording, edit `caption` in the hidden `<!-- social-draft … -->` block at the bottom of the issue body;
the poster re-runs the caption check against the stored facts before posting, so an edit cannot add a number.

## Turning posting on (Bluesky)

Off until all three are done:

1. In the InsideGov Bluesky account: Settings → Privacy and security → App passwords → add one (never the main password).
2. Repo secrets `BLUESKY_HANDLE` (e.g. `insidegov.bsky.social`) and `BLUESKY_APP_PASSWORD`.
3. Repo variable `SOCIAL_POSTING_ENABLED` = `true` (Settings → Secrets and variables → Actions → Variables).

Then labelling an issue `social-approved` runs `social-post.yml`: `bluesky.ts` logs in (`com.atproto.server.createSession`),
uploads the PNG (`com.atproto.repo.uploadBlob`), creates an `app.bsky.feed.post` with the link as a facet and the
image with its alt text, comments the post URL on the issue, labels it `social-posted` and closes it. Remove the variable
to turn posting off again.
