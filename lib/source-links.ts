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
  // Immigration context lines (rule 7d, draft). The ICE, CBP, executive-order and determination URLs are the ones
  // pipeline/reference/*-catalog.json and pipeline/output/refugee_*.json already record; the DHS fact sheets and the
  // State Department report are new here.
  "ohss-irca-fact-sheet-2009": "https://ohss.dhs.gov/sites/default/files/2023-12/Naturalization%2520Rates%2520IRCA%2520Immigrants%25202009.pdf",
  "ohss-naturalizations-2008": "https://ohss.dhs.gov/sites/default/files/2023-12/Naturalizations_2008.pdf",
  "state-refugee-report-fy2015": "https://www.rpc.state.gov/documents/Report+to+Congress+for+FY+2015+USRAP.pdf",
  "refugee-pd-2021-02": "https://www.federalregister.gov/d/2020-24912",
  "eo-14163": "https://www.govinfo.gov/content/pkg/FR-2025-01-30/html/2025-02011.htm",
  "eo-14204": "https://www.govinfo.gov/content/pkg/FR-2025-02-12/html/2025-02630.htm",
  "refugee-pd-2025-13": "https://www.govinfo.gov/content/pkg/FR-2025-10-31/html/2025-19752.htm",
  "cbp-release-2023-02": "https://www.cbp.gov/newsroom/national-media-release/cbp-releases-february-2023-monthly-operational-update",
  "cbp-release-2021-07": "https://www.cbp.gov/newsroom/national-media-release/cbp-releases-july-2021-operational-update",
  "crs-securing-the-border-2024": "https://www.everycrsreport.com/reports/LSB11178.html",
  "proclamation-10888": "https://www.govinfo.gov/content/pkg/FR-2025-01-29/html/2025-01951.htm",
  "ice-ero-report-fy2015": "https://www.ice.gov/sites/default/files/documents/Report/2016/fy2015removalStats.pdf",
  "ice-ero-report-fy2018": "https://www.ice.gov/doclib/about/offices/ero/pdf/eroFY2018Report.pdf",
  "ice-ero-report-fy2019": "https://www.ice.gov/sites/default/files/documents/Document/2019/eroReportFY2019.pdf",
  "ice-fy2023-annual-report-release": "https://www.ice.gov/news/releases/ice-releases-fiscal-year-2023-annual-report",
  // Trade, economy, energy
  "census-trade": "https://www.census.gov/foreign-trade/index.html",
  "usitc-dataweb": "https://dataweb.usitc.gov/",
  // Tariff actions behind the Trade page's context lines (rule 7d); each URL is recorded in pipeline/output/tariff_actions.json.
  "fr-301-china-2018": "https://www.federalregister.gov/documents/2018/06/20/2018-13248/notice-of-action-and-request-for-public-comment-concerning-proposed-determination-of-action-pursuant",
  "fr-301-china-list-4a": "https://www.federalregister.gov/documents/2019/08/20/2019-17865/notice-of-modification-of-section-301-action-chinas-acts-policies-and-practices-related-to",
  "fr-301-china-2024": "https://www.federalregister.gov/documents/2024/09/18/2024-21217/notice-of-modification-chinas-acts-policies-and-practices-related-to-technology-transfer",
  "fr-eo-14257": "https://www.federalregister.gov/documents/2025/04/07/2025-06063/regulating-imports-with-a-reciprocal-tariff-to-rectify-trade-practices-that-contribute-to-large-and",
  "scotus-learning-resources": "https://www.supremecourt.gov/opinions/25pdf/607us2r12_8nj9.pdf",
  "fr-eo-14389": "https://www.federalregister.gov/documents/2026/02/25/2026-03832/ending-certain-tariff-actions",
  "fr-section-122-2026": "https://www.federalregister.gov/documents/2026/02/25/2026-03824/imposing-a-temporary-import-surcharge-to-address-fundamental-international-payments-problems",
  "fr-301-forced-labor-2026": "https://www.federalregister.gov/documents/2026/07/28/2026-15181/notice-of-actions-in-section-301-investigations-of-acts-policies-and-practices-of-various-economies",
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
