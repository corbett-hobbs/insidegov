/**
 * Where each named source lives, so a note can link the name it already
 * prints (<SourceLink id="…">GovInfo Bill Status</SourceLink>) without
 * repeating the address. Every URL here is one the repo already records
 * (pipeline/reference/*-catalog.json, docs/*_SOURCE_NOTES.md, the
 * Methodology page's `lib/methodology-content.ts`), except where a
 * comment says otherwise. Add a source here, never as a literal href in a
 * note.
 */
export const SOURCE_LINKS = {
  // Congress and the law
  "govinfo-billstatus": "https://www.govinfo.gov/bulkdata/BILLSTATUS",
  "congress-gov": "https://www.congress.gov/",
  voteview: "https://voteview.com/data",
  "congress-legislators": "https://github.com/unitedstates/congress-legislators",
  "unitedstates-images": "https://github.com/unitedstates/images",
  mayhew: "https://campuspress.yale.edu/davidmayhew/datasets-divided-we-govern/",
  "senate-party-division": "https://www.senate.gov/history/partydiv.htm",
  "house-party-division": "https://history.house.gov/Institution/Party-Divisions/Party-Divisions/",
  "house-clerk-disclosures": "https://disclosures-clerk.house.gov/FinancialDisclosure",
  "senate-efd": "https://efdsearch.senate.gov/search/home/",
  // The Court
  scdb: "http://scdb.wustl.edu/data.php",
  "martin-quinn": "https://mqscores.wustl.edu/measures.php",
  fjc: "https://www.fjc.gov/history/judges",
  // The timeline's events each link their own article; the Source line names the site.
  wikipedia: "https://en.wikipedia.org/",
  "wikipedia-landmark-decisions": "https://en.wikipedia.org/wiki/List_of_landmark_court_decisions_in_the_United_States",
  // The presidency
  "federal-register-eo": "https://www.federalregister.gov/presidential-documents/executive-orders",
  // Federal Register search for the Presidential Determinations on refugee
  // admissions (document type "determination"); the pipeline reads each one
  // from the Federal Register and govinfo.gov (pipeline/reference/refugee-catalog.json).
  "refugee-determinations":
    "https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=%22refugee+admissions%22&conditions%5Bpresidential_document_type%5D%5B%5D=determination",
  // Immigration
  "wraps-admissions": "https://www.wrapsnet.org/admissions-and-arrivals/",
  "ohss-yearbook": "https://ohss.dhs.gov/topics/immigration/yearbook",
  "ohss-yearbook-table39": "https://ohss.dhs.gov/topics/immigration/yearbook/2023/table39",
  "ohss-legal-immigration": "https://ohss.dhs.gov/topics/immigration/legal-immigration-and-adjustment-status-report",
  "ohss-cbp-encounters": "https://ohss.dhs.gov/khsm/cbp-encounters",
  "cbp-encounters": "https://www.cbp.gov/newsroom/stats/nationwide-encounters",
  "ice-statistics": "https://www.ice.gov/statistics",
  "dhs-ice-budget-fy2027": "https://www.dhs.gov/sites/default/files/2026-04/26_0403_ocfo_fy27-budget-immigration-and-customs-enforcement.pdf",
  // Trade, economy, energy
  "census-trade": "https://www.census.gov/foreign-trade/index.html",
  "usitc-dataweb": "https://dataweb.usitc.gov/",
  eia: "https://www.eia.gov/",
  "eia-lng-exports": "https://www.eia.gov/dnav/ng/ng_move_expc_s1_m.htm",
  "eia-spr": "https://www.eia.gov/dnav/pet/pet_stoc_wstk_dcu_nus_w.htm",
  "eia-mer": "https://www.eia.gov/totalenergy/data/monthly/",
  "eia-electricity": "https://www.eia.gov/electricity/monthly/",
  fred: "https://fred.stlouisfed.org/",
  // FRED series pages: the economy page reads each series through FRED
  // (series ids in docs/INDICATORS_METHODOLOGY.md).
  "fred-unrate": "https://fred.stlouisfed.org/series/UNRATE",
  "fred-cpi": "https://fred.stlouisfed.org/series/CPIAUCSL",
  "fred-payrolls": "https://fred.stlouisfed.org/series/PAYEMS",
  "fred-gdp": "https://fred.stlouisfed.org/series/A191RO1Q156NBEA",
  "fred-wage": "https://fred.stlouisfed.org/series/AHETPI",
  "fred-income": "https://fred.stlouisfed.org/series/MEHOINUSA672N",
  "fred-gas": "https://fred.stlouisfed.org/series/GASREGW",
  "fred-mortgage": "https://fred.stlouisfed.org/series/MORTGAGE30US",
  "fred-deficit": "https://fred.stlouisfed.org/series/FYFSGDA188S",
  "fred-debt": "https://fred.stlouisfed.org/series/FYGFGDQ188S",
  "treasury-fiscal-data": "https://fiscaldata.treasury.gov/",
  "fred-deficit-usd": "https://fred.stlouisfed.org/series/FYFSD",
  "fred-debt-usd": "https://fred.stlouisfed.org/series/FYGFDPUN",
  "freddie-mac-pmms": "https://www.freddiemac.com/pmms",
  nber: "https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions",
  // Foreign aid and troops
  "foreign-assistance": "https://foreignassistance.gov/",
  dmdc: "https://dwp.dmdc.osd.mil/dwp/app/dod-data-reports/workforce-reports",
  troopdata: "https://github.com/meflynn/troopdata",
} as const;

export type SourceId = keyof typeof SOURCE_LINKS;
