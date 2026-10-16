import type { SourceId } from "../../lib/source-links";

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
      "Green cards peaked at 1.8M in FY1991. From FY2001 through FY2025 they ranged from 703.5k in FY2003 to 1.4M in FY2024, and immediate relatives of U.S. citizens were the largest class every year.",
  },
  naturalizations: {
    title: "Green cards and citizenships by fiscal year (Naturalizations)",
    takeaway:
      "Naturalizations passed 1M in two years, FY1996 and FY2008, after a low of 141k in FY1982. From FY2009 through FY2025 they ranged from 619.9k in FY2010 to 969.4k in FY2022.",
  },
  greenCardCountries: {
    title: "Where new permanent residents come from (Green cards)",
    takeaway:
      "Mexico led every year from FY1999 through FY2025, with 13% to 23% of each year’s green cards. In FY2024 Cuba was second with 184k, more than twice its count in any earlier year.",
  },
  naturalizationCountries: {
    title: "Where new permanent residents come from (Naturalizations)",
    takeaway:
      "Mexico led every year from FY1999 through FY2025, with 11% to 25% of each year’s new citizens. Its 231.8k in FY2008 was the most from any one country in any year.",
  },
  refugeeCeiling: {
    title: "Refugee ceiling and admissions by fiscal year",
    takeaway:
      "Refugee admissions peaked at 207.1k in FY1980 and hit a low of 11.4k in FY2021. FY2024’s 100k arrivals were the most of any year after FY1994, under a ceiling of 125k.",
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
      "From FY1980 through FY2020, CBP counted 0.5M to 1.7M border encounters a year. They topped 2.7M in each of FY2022–FY2024, peaking at 3.2M in FY2023, and were 0.7M in FY2025.",
  },
  removals: {
    title: "Removals, returns and detention by fiscal year",
    takeaway:
      "ICE removals peaked at 409.8k in FY2012 and fell to 59k in FY2021, the fewest of any ICE year (FY2003 on). FY2025’s preliminary 442.6k is the most of any year on the chart, which starts in FY1980.",
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

/**
 * The context line under a takeaway (ARCHITECTURE_MAP rule 7d, draft): one or two muted sentences, only where the takeaway's
 * highlight would otherwise be misread, and only of two kinds: what a dated official document did, or a change in what the
 * source counts. A cause appears only when the agency's own report states it, and then as the agency's. Contested,
 * multi-factor causes never go here (they would be dated policy markers on the chart instead). Each line names its sources,
 * and every figure is checked in lib/immigration-takeaways.test.ts.
 */
export interface ContextEntry {
  text: string;
  sources: readonly { id: SourceId; label: string }[];
}

export const IMMIGRATION_CONTEXT = {
  greenCards: {
    text: "The FY1989–FY1991 peak includes legalization under the Immigration Reform and Control Act of 1986: DHS reports that nearly 2.7M people got green cards through it, almost all in 1989–1992.",
    sources: [{ id: "ohss-irca-fact-sheet-2009", label: "DHS fact sheet" }],
  },
  naturalizations: {
    text: "DHS attributes the mid-1990s rise mainly to people legalized under the 1986 law becoming eligible, and the FY2008 record mainly to nearly 1.4M applications filed in 2007 ahead of a fee increase.",
    sources: [{ id: "ohss-naturalizations-2008", label: "DHS, Naturalizations 2008" }],
  },
  refugeeCeiling: {
    text: "COVID-19 largely halted refugee travel from spring 2020. Executive Order 14163 suspended refugee entry from January 27, 2025; 37.6k of FY2025’s 38.1k refugees arrived before February.",
    sources: [
      { id: "refugee-pd-2021-02", label: "FY2021 determination" },
      { id: "eo-14163", label: "EO 14163" },
    ],
  },
  refugeeCountries: {
    text: "Executive Order 14204 (February 7, 2025) directed that Afrikaners in South Africa be prioritized for resettlement, and the FY2026 determination allocates admissions primarily to them.",
    sources: [
      { id: "eo-14204", label: "EO 14204" },
      { id: "refugee-pd-2025-13", label: "FY2026 determination" },
    ],
  },
  refugeeTop: {
    text: "In its FY2015 report to Congress, the State Department said it would help the UN refugee agency resettle at least 50k Congolese over four to five years, most from camps in Uganda, Tanzania, Rwanda and Burundi.",
    sources: [{ id: "state-refugee-report-fy2015", label: "State Department" }],
  },
  encounters: {
    text: "CBP said Title 42 expulsions added repeat crossings: 27% of July 2021’s southwest encounters had been caught in the prior year, against 14% in FY2014–FY2019. Border Patrol’s monthly count fell by half or more within two months of each entry proclamation (June 2024, January 2025).",
    sources: [
      { id: "cbp-release-2021-07", label: "CBP, July 2021" },
      { id: "crs-securing-the-border-2024", label: "CRS on the June 2024 proclamation" },
      { id: "proclamation-10888", label: "Proclamation 10888" },
    ],
  },

  removals: {
    text: "From March 2020 to May 2023, many border crossers were expelled under Title 42, which ICE does not count as removals: 1.1M in both FY2021 and FY2022, by CBP’s count. After Title 42 ended, removals rose to 271.5k in FY2024, 82% after Border Patrol arrests.",
    sources: [
      { id: "ice-fy2023-annual-report-release", label: "ICE" },
      { id: "cbp-encounters", label: "CBP" },
    ],
  },
  criminalHistory: {
    text: "ICE records only what its systems hold when it acts, and people caught at the border have usually just arrived, so most have no U.S. record: 80% of FY2024’s Border Patrol handoffs. ICE counts immigration crimes, such as illegal reentry, as convictions.",
    sources: [
      { id: "ice-ero-report-fy2019", label: "ICE FY2019" },
      { id: "ice-ero-report-fy2018", label: "ICE FY2018" },
    ],
  },

} satisfies Partial<Record<keyof typeof IMMIGRATION_TAKEAWAYS, ContextEntry>>;
