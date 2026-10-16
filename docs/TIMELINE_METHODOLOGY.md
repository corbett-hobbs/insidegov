# Timeline methodology ("Who Held Power When It Happened?", `/timeline`)

The page sets hand-picked landmark laws and Supreme Court cases since 4 March 1933 against who held the White House, the
Senate, the House and the Court that day. Who held power describes the setting of an event, not its cause.

## What is curated and what is joined

- **Curated:** `pipeline/reference/timeline-events.json` (schema `lib/timeline-entities.ts`): which events, a one-line
  description each, its Wikipedia title (checked through the MediaWiki API, redirects followed, 2026-10-16), its SCDB
  `case_id` or `laws.json` `law_id` where one exists, the laws a listed case ruled on (`tested`) and the listed cases that
  overruled, narrowed or built on each other (`case_links`). It also holds the data the pipeline lacks, each marked:
  - the six cases before the SCDB data starts (1946): their vote and dissenters' last names (`hand_vote`);
  - the 1964 Civil Rights Act and 1965 Voting Rights Act final-passage splits by party (`hand_split`, typed in from the
    record, to verify against Voteview); the page labels them "typed in from the record";
  - Willis Van Devanter (`extra_justices`), who left in June 1937, before `court/justices.json` (Martin-Quinn) starts;
  - Bakke's decision date (June 28, 1978; SCDB records June 26).
- **Joined at build time** (`lib/timeline-build.ts`, read through the server-only `lib/timeline-data.ts`): presidents
  (`HISTORICAL_ADMINISTRATIONS` + `administrations.json`), Congress majorities by date and seats at the start of each
  Congress (`pipeline/reference/congress-control.json`), justices (`court/justices.json`), each term's median
  (`court/court_terms.json`), case votes (`decisions_cases.json`, `court/justice_votes.json`), law dates and veto overrides
  (`laws.json`) and member votes (`law_votes/`). Nothing pre-joined is stored. The pure rules are in
  `lib/timeline-derive.ts`, unit-tested in `lib/timeline-derive.test.ts`.

## Rules

- **President:** in office from inauguration to the successor's (Kennedy/Johnson and Nixon/Ford split on the day).
- **Senate and House:** the majority by date from `congress-control.json`. Senate independents count with the party they
  caucused with. The tied Senates follow the vice president's vote: 2001 (Gore, then Cheney, then Democrats after
  Jeffords left the Republicans on June 6, then Republicans from November 12, 2002) and 2021 (Republicans to January 19,
  then Democrats through Vice President Harris). Seat counts are each party's at the start of each Congress.
- **Court, "Lean" (default):** the median justice's Martin-Quinn score for the term sitting that day (a term opens in
  October). A term split into segments (a justice joined or left mid-term) uses the later segment's median, the one
  sitting at the term's end. Liberal (negative) counts as the Democratic side, conservative as the Republican side, and a
  median within 0.15 of zero is the centre (neither side). There is no score before the October 1937 term. Scores are
  estimated from the justices' own votes, so they describe how the Court voted rather than explain it.
- **Court, "Appointed by":** the party of the president who first appointed each sitting justice (Stone stays a Coolidge
  appointee after Roosevelt made him chief); the Court counts with the party that appointed most of it, and an even split
  (2016-17, after Scalia's death) is a tie. A seat empty for under six months counts with the justice who left it, so a
  summer vacancy doesn't flip the balance; a longer one shows as the even split it was. Each departing justice is paired
  with the next to join (a week's overlap allowed, since Scalia's recorded start is a day before Burger's end).
- **Status:** "all four on one side" when one party held the White House and both chambers and the Court was on its side
  under the measure picked; "White House and Congress, not the Court" when the Court was not (centre and no-score count as
  not); otherwise "power was divided". The one-party strip, tiles, era list and notes all follow the measure picked.
- **Eras:** neighbouring stretches with the same president's party, Senate, House and Court side, merged.
- **Case votes:** majority and dissent counted by each justice's appointing party, from SCDB's justice-centred data (1946
  term on); before that, the bench sitting that day (recorded service dates) split by the hand-entered dissenters.
- **Law votes:** final-passage roll calls from Voteview as checked by the Laws pipeline (`law_votes/`, 1973 on), each
  member counted with their caucus in `terms.json`. A member who changed party mid-Congress counts with the caucus they sat
  with on the day of the roll call (dated from `pipeline/raw/voteview/rollcalls_93on.json`): Specter is a Democrat on the
  December 2009 health-care vote, Jeffords still a Republican on the May 2001 tax-cut vote. Laws before 1973 other than the
  two typed-in splits show no party vote.

## Markers

Events are numbered in date order. On the chart, markers sit in 22px bins that alternate between two sub-lanes per row; a
bin holding several events shows one marker, "22+4" (event 22 and four more), and its note lists them all. A lone marker
with room to its right carries the event's name.

## Review

The list is reviewed by hand (`last_reviewed` in the reference file). Adding an event: give it an `id`, `kind`, `name`,
`what`, `wiki` and either a `law_id` / `case_id` or a `date` (plus `hand_vote` for a case before 1946); the reader fails
the build if an id does not join, a date disagrees with `laws.json`, or a hand-entered dissenter was not on the bench.
