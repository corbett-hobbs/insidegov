/**
 * The takeaway under each Foreign aid chart title (ARCHITECTURE_MAP rule 7c): what the chart
 * shows in its default view (all countries, all sectors, FY2001 through the latest year, the
 * map on the default year), in at most two sentences. Dollars are nominal, as the source
 * publishes them. Every figure here is checked against pipeline/output in
 * lib/foreign-aid-takeaways.test.ts; a refresh that makes one untrue fails CI.
 */
export const AID_TAKEAWAYS = {
  spending:
    "In nominal dollars, disbursements rose from $15.0 billion in FY2001 to between $42 billion and $49 billion a year from FY2010 through FY2021, then peaked at $80.5 billion in FY2023. Peace and security was the largest sector every year through FY2020.",
  map: "In FY2025, Ukraine received the most, $6.8 billion, followed by Israel at $3.3 billion, nearly all of it military. About a third of that year’s dollars went to global and regional programs rather than one country, so the map leaves them out.",
  firstPlace:
    "Afghanistan was the largest recipient for 13 straight years, FY2008 through FY2020, and Ukraine from FY2022 through FY2025. Ukraine’s $24.8 billion in FY2023 was 42% of the dollars tied to a single country, the largest share any No. 1 took.",
} as const;
