/**
 * The takeaway under each Immigration chart title (ARCHITECTURE_MAP rule 7c): what the chart shows over its full default window
 * (the page's FY1980 start, or the card's own first year when its data starts later), in at most two sentences. The green-card
 * cards have one per Green cards / Naturalizations choice, since the toggle swaps the whole chart. Every figure here is checked
 * against pipeline/output in lib/immigration-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const IMMIGRATION_TAKEAWAYS = {
  greenCards: {
    title: "Green cards and citizenships by fiscal year (Green cards)",
    takeaway:
      "Green cards peaked at 1.83 million in FY1991. From FY2001 through FY2025 they ranged from 703,542 in FY2003 to 1.36 million in FY2024, and immediate relatives of U.S. citizens were the largest class every year.",
  },
  naturalizations: {
    title: "Green cards and citizenships by fiscal year (Naturalizations)",
    takeaway:
      "Naturalizations passed 1 million in two years, FY1996 and FY2008, after a low of 141,000 in FY1982. From FY2009 through FY2025 they ranged from 619,910 in FY2010 to 969,380 in FY2022.",
  },
  greenCardCountries: {
    title: "Where new permanent residents come from (Green cards)",
    takeaway:
      "Mexico led every year from FY1999 through FY2025, with 13% to 23% of each year’s green cards. In FY2024 Cuba was second with 184,040, more than twice its count in any earlier year.",
  },
  naturalizationCountries: {
    title: "Where new permanent residents come from (Naturalizations)",
    takeaway:
      "Mexico led every year from FY1999 through FY2025, with 11% to 25% of each year’s new citizens. Its 231,815 in FY2008 was the most from any one country in any year.",
  },
  refugeeCeiling: {
    title: "Refugee ceiling and admissions by fiscal year",
    takeaway:
      "Refugee admissions peaked at 207,116 in FY1980 and hit a low of 11,411 in FY2021. FY2024’s 100,034 arrivals were the most of any year after FY1994, under a ceiling of 125,000.",
  },
  refugeeCountries: {
    title: "Where refugees came from",
    takeaway:
      "From FY2001 through FY2025, refugees came from 50 to 85 countries a year, the most in FY2024. In FY2026 (preliminary), all but five came from South Africa.",
  },
  refugeeTop: {
    title: "Who’s sent the most refugees",
    takeaway:
      "From FY2001 through FY2015, six countries took turns as the largest source of refugees. The Democratic Republic of the Congo then led every year from FY2016 through FY2024, the longest run on the chart.",
  },
  encounters: {
    title: "Border encounters by fiscal year",
    takeaway:
      "From FY1980 through FY2020, CBP counted 0.5 million to 1.7 million border encounters a year. They topped 2.7 million in each of FY2022–FY2024, peaking at 3.2 million in FY2023, and were 0.7 million in FY2025.",
  },
  removals: {
    title: "Removals, returns and detention by fiscal year",
    takeaway:
      "ICE removals peaked at 409,849 in FY2012 and fell to 59,011 in FY2021, the fewest of any ICE year (FY2003 on). FY2025’s preliminary 442,637 is the most of any year on the chart, which starts in FY1980.",
  },
  criminalHistory: {
    title: "Criminal history of those removed",
    takeaway:
      "Of the people ICE removed from FY2013 through FY2022, 53% to 66% each year had a criminal conviction on record; in FY2024, 25% did. Among those ICE’s own officers arrested, the share stayed above 75% from FY2017 through FY2024.",
  },
  removalsCountries: {
    title: "Who gets removed",
    takeaway:
      "Mexico led ICE removals by country of citizenship every year from FY2014 through FY2024, with Guatemala second or third. Mexico’s share peaked at 62% in FY2016 and fell to 32% by FY2024.",
  },
} as const;
