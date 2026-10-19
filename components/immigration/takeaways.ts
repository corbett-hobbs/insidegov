import type { ContextEntry } from "../../lib/chart-context";

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
 * The context line under a takeaway (ARCHITECTURE_MAP rule 7d): one or two muted sentences naming the dated political
 * events behind what the chart shows (a statute, an executive order, a proclamation, a Presidential Determination, an agency
 * rule or order), preferring the last ten years, and saying which feature of the chart each lines up with. How a number is
 * counted belongs in the card's Data notes, never here. A cause appears only when the agency's own report states it, and
 * then as the agency's; contested, multi-factor causes never go here. Each line names its sources, and every figure is
 * checked in lib/immigration-takeaways.test.ts.
 */
export const IMMIGRATION_CONTEXT = {
  greenCards: {
    text: "The FY1989–FY1991 peak includes legalizations under the 1986 Immigration Reform and Control Act: nearly 2.7M green cards, almost all in 1989–1992. Proclamation 10014 suspended entry for many immigrants from abroad (April 2020–February 2021) during the FY2020–FY2021 dip, which DHS ties to the pandemic.",
    sources: [
      { id: "ohss-irca-fact-sheet-2009", label: "DHS on IRCA" },
      { id: "proclamation-10014", label: "Proclamation 10014" },
      { id: "ohss-lpr-flow-2021", label: "DHS" },
    ],
  },
  naturalizations: {
    text: "DHS attributes the mid-1990s rise partly to 2.7M people legalized under the 1986 Immigration Reform and Control Act becoming eligible, and the FY2008 record mainly to nearly 1.4M applications filed in 2007 ahead of a fee increase that took effect July 30, 2007.",
    sources: [
      { id: "ohss-naturalizations-2008", label: "DHS 2008 report" },
      { id: "uscis-fee-rule-2007", label: "2007 fee rule" },
    ],
  },
  refugeeCeiling: {
    text: "The FY2021 low came under a ceiling first set at 15k (October 2020) and raised to 62.5k (May 2021). Executive Order 14163 suspended refugee entry from January 27, 2025; 37.6k of FY2025’s 38.1k refugees arrived before February.",
    sources: [
      { id: "refugee-pd-2021-02", label: "2020" },
      { id: "refugee-pd-2021-06", label: "2021 determinations" },
      { id: "eo-14163", label: "EO 14163" },
    ],
  },
  refugeeCountries: {
    text: "Executive Order 14204 (February 7, 2025) directed that Afrikaners in South Africa be prioritized for resettlement. The FY2026 determination allocates its 7.5k admissions primarily to them, and a May 2026 determination added 10k more for Afrikaners alone.",
    sources: [
      { id: "eo-14204", label: "EO 14204" },
      { id: "refugee-pd-2025-13", label: "2025" },
      { id: "refugee-pd-2026-14", label: "2026 determinations" },
    ],
  },
  refugeeTop: {
    text: "The State Department’s FY2015 report said fighting between Congo’s government and M23 rebels since mid-2012 left the east too insecure for refugees to return, and that Congolese admissions would rise steadily. The DRC led from FY2016; FY2018–FY2023 determinations all gave Africa the largest share.",
    sources: [
      { id: "state-refugee-report-fy2015", label: "State Department" },
      { id: "refugee-determinations", label: "determinations" },
    ],
  },
  encounters: {
    text: "CBP said Title 42 expulsions (from March 2020) added repeat crossings: 27% of July 2021’s southwest encounters, against 14% in FY2014–FY2019. In the drop to FY2025’s 0.7M, Border Patrol’s monthly count at least halved within two months of each entry proclamation (June 2024, January 2025).",
    sources: [
      { id: "cbp-release-2021-07", label: "CBP" },
      { id: "crs-securing-the-border-2024", label: "CRS" },
      { id: "proclamation-10888", label: "Proclamation 10888" },
    ],
  },
  removals: {
    text: "ICE says its work shifted to expulsions under the CDC’s Title 42 order (March 2020–May 2023), cutting removals to the FY2021 low; CBP counted 1.1M expulsions in both FY2021 and FY2022. After it ended, removals rose to 271.5k in FY2024, 82% after Border Patrol arrests.",
    sources: [
      { id: "ice-senate-testimony-2023", label: "ICE 2023 testimony" },
      { id: "ice-fy2023-annual-report-release", label: "ICE FY2023" },
      { id: "cbp-encounters", label: "CBP" },
    ],
  },
} satisfies Partial<Record<keyof typeof IMMIGRATION_TAKEAWAYS, ContextEntry>>;

/** The context entry for a card, or null where it has none. */
export const contextFor = (card: keyof typeof IMMIGRATION_TAKEAWAYS): ContextEntry | null =>
  (IMMIGRATION_CONTEXT as Partial<Record<keyof typeof IMMIGRATION_TAKEAWAYS, ContextEntry>>)[card] ?? null;
