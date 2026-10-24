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
      both: "Democrats were the older caucus from the 104th through the 118th (1995–2024) and peaked at 62.2 in the 115th (2017–2018). Median ages were lowest in the early 1980s: 49.0 for Republicans in the 97th Congress (1981–1982) and 49.5 for Democrats in the 98th.",
      house: "House Democrats were the older caucus from the 103rd through the 118th (1993–2024) and peaked at 62.2 in the 115th (2017–2018). Median ages were lowest in the early 1980s: 48.2 for Republicans in the 97th Congress (1981–1982) and 48.3 for Democrats in the 98th.",
      senate: "Senate Republicans peaked at 65.1 in the 117th (2021–2022), and Democrats were over 60 in every Congress from the 108th through the 119th. Median ages were lowest at 50.1 for Republicans in the 97th Congress (1981–1982) and 52.4 for Democrats in the 95th (1977–1978).",
    },
  },
  women: {
    title: "How many members are women?",
    takeaway: {
      both: "The 113th Congress (2013–2014) was the first with over 100 women, up from 54 in the 103rd (1993–1994), the first with more than 33. Democratic women outnumbered Republican women in every Congress from the 100th through the 119th.",
      house: "The 116th Congress (2019–2020) was the first with over 100 women in the House, up from 47 in the 103rd (1993–1994), the first with more than 29. Democratic women outnumbered Republican women in every Congress from the 89th through the 119th.",
      senate: "The 113th Congress (2013–2014) was the first with 20 women senators, up from 7 in the 103rd (1993–1994) and no more than 3 in any Congress through 1990. Democratic women outnumbered Republican women in every Congress from the 102nd through the 119th.",
    },
  },
  tenure: {
    title: "How long have members been in Congress?",
    takeaway: {
      both: "Members with over 20 years in Congress peaked at 20% in the 115th (2017–2018), up from 6.2% of the 73rd Congress (1933–1934). Those with up to 2 years were no more than 23% from the 79th through the 119th, against 33% of the 73rd.",
      house: "House members with over 20 years in Congress peaked at 17% in the 115th (2017–2018), up from 4% of the 73rd Congress (1933–1934). Those with up to 2 years were no more than 26% from the 79th through the 119th, against 36% of the 73rd.",
      senate: "Senators with over 20 years in Congress peaked at 43% of the 110th (2007–2008), up from a low of 8.6% in the 82nd (1951–1952). Those with up to 2 years were under 10% in every Congress from the 98th through the 119th but the 111th.",
    },
  },
} as const satisfies Record<string, { title: string; takeaway: Record<ChamberView, string> }>;
