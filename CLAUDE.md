@AGENTS.md

## Page titles and subtitles

Every top-level page's `<h1>` + intro copy goes through `components/PageHeader.tsx`. It has no max-width on purpose: the header always spans the full width of the page's `<main>`. Never put `max-w-*` on a page header or its intro paragraphs; to narrow text, narrow `<main>`.

## Social chart images

Every chart `pipeline/insights` draws takes a plain, human title (`Series.title`: "Inflation, 2016 to 2026") and puts method and fine print in the data note beside the source at the bottom left (`Series.note`); the axis label is the unit only. `pipeline/insights/title.ts` builds and enforces it, and `title.test.ts` checks every generator on the real data. Follow it for any new chart type; see "Chart titles and data notes" in `pipeline/insights/README.md`.

## Architecture map

Before building or changing a page, chart or filter bar, read `ARCHITECTURE_MAP.md`. Its "Page-level layout rules" section holds the standing UI conventions (compact pinned filter bars, tap-to-pin numbered labels, "Data notes" under charts, solid colours, zoom/pan, labels that never vanish, nav overflow hints). Follow them instead of asking for them again, and update that file when a new convention is settled.
