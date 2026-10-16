import type { ChamberView } from "../../lib/chamber";

/**
 * The takeaway under each Congress demographics chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its full
 * default window (the 73rd through the 119th Congress, every party), in at most two sentences. The page's Chamber switch
 * changes the facts, so each card has one sentence pair per chamber view and shows the one picked. Every figure here is
 * checked against pipeline/output in lib/demographics-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const DEMO_TAKEAWAYS = {
  age: {
    title: "Is Congress getting older?",
    takeaway: {
      both: "Median ages were lowest in the early 1980s: 49.0 for Republicans in the 97th Congress (1981–1982) and 49.5 for Democrats in the 98th. Democrats peaked at 62.2 in the 115th (2017–2018) and were the older caucus from the 104th through the 118th (1995–2024).",
      house: "House median ages were lowest in the early 1980s: 48.2 for Republicans in the 97th Congress (1981–1982) and 48.3 for Democrats in the 98th. Democrats peaked at 62.2 in the 115th (2017–2018) and were the older caucus from the 103rd through the 118th (1993–2024).",
      senate: "Senate median ages were lowest at 50.1 for Republicans in the 97th Congress (1981–1982) and 52.4 for Democrats in the 95th (1977–1978). Republicans peaked at 65.1 in the 117th (2021–2022); Democrats were over 60 in every Congress from the 108th through the 119th.",
    },
  },
  women: {
    title: "How many members are women?",
    takeaway: {
      both: "Congress never had more than 33 women from the 73rd through the 102nd (1933–1992); the 103rd (1993–1994) had 54, and the 113th (2013–2014) was the first with over 100. Democratic women outnumbered Republican women in every Congress from the 100th through the 119th.",
      house: "The House never had more than 29 women from the 73rd through the 102nd Congress (1933–1992); the 103rd (1993–1994) had 47, and the 116th (2019–2020) was the first with over 100. Democratic women outnumbered Republican women in every Congress from the 89th through the 119th.",
      senate: "The Senate never had more than 3 women from the 73rd through the 101st Congress (1933–1990); the 103rd (1993–1994) had 7, and the 113th (2013–2014) was the first with 20. Democratic women outnumbered Republican women in every Congress from the 102nd through the 119th.",
    },
  },
  tenure: {
    title: "How long have members been in Congress?",
    takeaway: {
      both: "Members with over 20 years in Congress were 6.2% of the 73rd Congress (1933–1934) and peaked at 20% in the 115th (2017–2018). Those with up to 2 years were 33% of the 73rd, and no more than 23% from the 79th through the 119th.",
      house: "House members with over 20 years in Congress were 4% of the 73rd Congress (1933–1934) and peaked at 17% in the 115th (2017–2018). Those with up to 2 years were 36% of the 73rd, and no more than 26% from the 79th through the 119th.",
      senate: "Senators with over 20 years in Congress were 8.6% of the 82nd Congress (1951–1952), the low, and 43% of the 110th (2007–2008), the peak. Those with up to 2 years were under 10% in every Congress from the 98th through the 119th but the 111th.",
    },
  },
} as const satisfies Record<string, { title: string; takeaway: Record<ChamberView, string> }>;
