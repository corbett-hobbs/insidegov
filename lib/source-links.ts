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
  // The Congress ideology trend card's context line (rule 7d): the two statutes as enacted, 78 Stat. 241 and 79 Stat. 437 (new here).
  "civil-rights-act-1964": "https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg241.pdf",
  "voting-rights-act-1965": "https://www.govinfo.gov/content/pkg/STATUTE-79/pdf/STATUTE-79-Pg437.pdf",
  "congress-legislators": "https://github.com/unitedstates/congress-legislators",
  "unitedstates-images": "https://github.com/unitedstates/images",
  mayhew: "https://campuspress.yale.edu/davidmayhew/datasets-divided-we-govern/",
  "senate-party-division": "https://www.senate.gov/history/partydiv.htm",
  "house-party-division": "https://history.house.gov/Institution/Party-Divisions/Party-Divisions/",
  // The Laws count card's context line (rule 7d): the 2023 Speaker elections (House History's multiple-ballot table), the
  // vote vacating the chair (Clerk roll call 519, October 3, 2023) and the swearing-in statute (new here).
  "house-speaker-ballots": "https://history.house.gov/People/Office/Speakers-Multiple-Ballots/",
  "house-roll-call-2023-519": "https://clerk.house.gov/Votes/2023519",
  "usc-2-25": "https://www.law.cornell.edu/uscode/text/2/25",
  // The Congress ideology committees card's context line (rule 7d): the House Ethics Committee's history, "the only standing
  // committee of the House whose membership is evenly divided between each political party" (new here).
  "house-ethics-history": "https://ethics.house.gov/committee-history",
  // CRS report 98-662, "Commemorative Legislation: Evolution and Procedures": the House rule of January 4, 1995 (Laws groups card's context, rule 7d).
  "crs-commemorative-legislation": "https://www.everycrsreport.com/reports/98-662.html",
  "house-clerk-disclosures": "https://disclosures-clerk.house.gov/FinancialDisclosure",
  "senate-efd": "https://efdsearch.senate.gov/search/home/",
  // The Court
  scdb: "http://scdb.wustl.edu/data.php",
  // The codebook the decision pages' labels come from (pipeline/reference/scdb-codebook.json records it).
  "scdb-codebook": "http://scdb.wustl.edu/documentation.php",
  "martin-quinn": "https://mqscores.wustl.edu/measures.php",
  fjc: "https://www.fjc.gov/history/judges",
  // The decisions page's context line (rule 7d): the Supreme Court Case Selections Act as enacted, 102 Stat. 662 (new here).
  // The Senate's record of Supreme Court nominations and their votes (new here).
  "senate-scotus-nominations": "https://www.senate.gov/legislative/nominations/SupremeCourtNominations1789present.htm",
  "plaw-100-352": "https://www.govinfo.gov/content/pkg/STATUTE-102/pdf/STATUTE-102-Pg662.pdf",
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
  // Immigration context lines (rule 7d). The ICE, CBP, executive-order and determination URLs are the ones
  // pipeline/reference/*-catalog.json and pipeline/output/refugee_*.json already record; the DHS reports, the State
  // Department report, the 2007 fee rule, Proclamation 10014 and the ICE testimony are new here.
  "ohss-irca-fact-sheet-2009": "https://ohss.dhs.gov/sites/default/files/2023-12/Naturalization%2520Rates%2520IRCA%2520Immigrants%25202009.pdf",
  "ohss-naturalizations-2008": "https://ohss.dhs.gov/sites/default/files/2023-12/Naturalizations_2008.pdf",
  "ohss-lpr-flow-2021": "https://ohss.dhs.gov/sites/default/files/2023-12/2022_0405_plcy_lawful_permanent_residents_fy2021v2.pdf",
  "uscis-fee-rule-2007": "https://www.govinfo.gov/content/pkg/FR-2007-05-30/html/E7-10371.htm",
  "proclamation-10014": "https://www.govinfo.gov/content/pkg/FR-2020-04-27/html/2020-09068.htm",
  "state-refugee-report-fy2015": "https://www.rpc.state.gov/documents/Report+to+Congress+for+FY+2015+USRAP.pdf",
  "refugee-pd-2021-02": "https://www.federalregister.gov/d/2020-24912",
  "refugee-pd-2021-06": "https://www.govinfo.gov/content/pkg/FR-2021-05-07/html/2021-09861.htm",
  "eo-14163": "https://www.govinfo.gov/content/pkg/FR-2025-01-30/html/2025-02011.htm",
  "eo-14204": "https://www.govinfo.gov/content/pkg/FR-2025-02-12/html/2025-02630.htm",
  "refugee-pd-2025-13": "https://www.govinfo.gov/content/pkg/FR-2025-10-31/html/2025-19752.htm",
  "refugee-pd-2026-14": "https://www.govinfo.gov/content/pkg/FR-2026-05-27/html/2026-10598.htm",
  "cbp-release-2023-02": "https://www.cbp.gov/newsroom/national-media-release/cbp-releases-february-2023-monthly-operational-update",
  "cbp-release-2021-07": "https://www.cbp.gov/newsroom/national-media-release/cbp-releases-july-2021-operational-update",
  "crs-securing-the-border-2024": "https://www.everycrsreport.com/reports/LSB11178.html",
  "proclamation-10888": "https://www.govinfo.gov/content/pkg/FR-2025-01-29/html/2025-01951.htm",
  "ice-ero-report-fy2015": "https://www.ice.gov/sites/default/files/documents/Report/2016/fy2015removalStats.pdf",
  "ice-ero-report-fy2018": "https://www.ice.gov/doclib/about/offices/ero/pdf/eroFY2018Report.pdf",
  "ice-ero-report-fy2019": "https://www.ice.gov/sites/default/files/documents/Document/2019/eroReportFY2019.pdf",
  "ice-fy2023-annual-report-release": "https://www.ice.gov/news/releases/ice-releases-fiscal-year-2023-annual-report",
  "ice-senate-testimony-2023": "https://www.hsgac.senate.gov/wp-content/uploads/GovOps-September-6th-Hearing-ICE-Bible-Testimony.pdf",
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
  // Energy context lines (rule 7d)
  "doe-sabine-pass-docket": "https://hgeo.energy.gov/ng_regulation/sabine-pass-liquefaction-llc-fe-dkt-no-10-111-lng",
  "doe-lng-order-3357": "https://hgeo.energy.gov/ng_regulation/sites/default/files/programs/gasregulation/authorizations/2013/orders/ord3357.pdf",
  "plaw-117-103": "https://www.govinfo.gov/content/pkg/PLAW-117publ103/html/PLAW-117publ103.htm",
  "plaw-117-128": "https://www.govinfo.gov/content/pkg/PLAW-117publ128/html/PLAW-117publ128.htm",
  "plaw-117-180": "https://www.govinfo.gov/content/pkg/PLAW-117publ180/html/PLAW-117publ180.htm",
  "plaw-117-328": "https://www.govinfo.gov/content/pkg/PLAW-117publ328/html/PLAW-117publ328.htm",
  "plaw-118-50": "https://www.govinfo.gov/content/pkg/PLAW-118publ50/html/PLAW-118publ50.htm",
  "fr-eo-14169": "https://www.federalregister.gov/d/2025-02091",
  "plaw-114-113": "https://www.govinfo.gov/content/pkg/PLAW-114publ113/html/PLAW-114publ113.htm",
  "doe-spr-history": "https://www.energy.gov/hgeo/opr/history-spr-releases",
  "doe-spr-172m-exchange-2026": "https://www.energy.gov/articles/united-states-release-172-million-barrels-oil-strategic-petroleum-reserve",
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
  // Economy context lines (rule 7d), added with them: the Fed's FOMC statements and CBO's CARES Act estimate (April 16, 2020).
  "fomc-statements": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  "cbo-cares-act": "https://www.cbo.gov/publication/56334",
  "congress-arpa": "https://www.congress.gov/bill/117th-congress/house-bill/1319",
  // The October 2025 shutdown's gap (BLS household survey and CPI pages), the March 2020 emergency and BLS's April 2020 jobs report.
  "bls-cps-shutdown-2025": "https://www.bls.gov/cps/methods/2025-federal-government-shutdown-impact-cps.htm",
  "bls-cpi-shutdown-2025": "https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi-faq.htm",
  "fr-proclamation-9994": "https://www.federalregister.gov/documents/2020/03/18/2020-05794/declaring-a-national-emergency-concerning-the-novel-coronavirus-disease-covid-19-outbreak",
  "bls-empsit-april-2020": "https://www.bls.gov/news.release/archives/empsit_05082020.htm",
  // Foreign aid and troops
  "foreign-assistance": "https://foreignassistance.gov/",
  dmdc: "https://dwp.dmdc.osd.mil/dwp/app/dod-data-reports/workforce-reports",
  troopdata: "https://github.com/meflynn/troopdata",
  // Troops abroad context lines (rule 7d): the 1953 Korean armistice, the Southeast Asia and Iraq force authorizations,
  // the Feb 12, 2013 State of the Union, the July 29, 2020 Germany posture plan and the Feb 4, 2021 remarks that stopped it.
  "korea-armistice-1953": "https://www.archives.gov/milestone-documents/armistice-agreement-restoration-south-korean-state",
  "plaw-88-408": "https://www.govinfo.gov/content/pkg/STATUTE-78/pdf/STATUTE-78-Pg384.pdf",
  "plaw-107-243": "https://www.govinfo.gov/content/pkg/PLAW-107publ243/html/PLAW-107publ243.htm",
  "dod-eucom-posture-2020": "https://www.war.gov/News/Releases/Release/Article/2292244/department-of-defense-statement-us-european-command-force-posture-review/",
  "biden-state-dept-2021": "https://bidenwhitehouse.archives.gov/briefing-room/speeches-remarks/2021/02/04/remarks-by-president-biden-on-americas-place-in-the-world/",
  "obama-sotu-2013": "https://obamawhitehouse.archives.gov/the-press-office/2013/02/12/remarks-president-state-union-address",
} as const;

export type SourceId = keyof typeof SOURCE_LINKS;
