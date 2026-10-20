import type { ReactNode } from "react";
import { SourceLink } from "@/components/SourceLink";
import type { SeriesCardId } from "@/lib/president-types";


/** One "Data notes" paragraph per president-page card (rule 7: what it counts, the caveat a reader could misread, the source). */
export const NOTES: Record<SeriesCardId | "congress" | "justices" | "major" | "timeline" | "eos", ReactNode> & { laws: (through: string) => ReactNode } = {
  congress: (
    <p>
      Each Congress is clipped to the days this president was in office; one that convened less than a month before the president left is left out. A chamber&rsquo;s majority is the party that held it for most of those days; seat counts are at the start of the Congress, with independents counted with the party they caucused with. From the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians&rsquo; party divisions.
    </p>
  ),
  justices: (
    <p>
      A justice counts for the president who nominated them (a recess appointment from the day it began, if earlier). An associate justice later made chief by another president, like William Rehnquist, counts as an elevation for the second. Failed and withdrawn nominations are not listed. Dates and Senate votes from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>.
    </p>
  ),
  laws: (through: string) => (
    <p>
      Public laws whose enactment date falls in the term, from <SourceLink id="congress-gov">Congress.gov</SourceLink> (93rd Congress, 1973, on; private laws left out), counted through {through}. A law enacted over a veto is not counted as signed; a bill that became law without a signature is. A bar is one year in office, from the inauguration to the day before its anniversary. Policy areas are the Congressional Research Service&rsquo;s, grouped as on the Laws page.
    </p>
  ),
  eos: (
    <p>
      Executive orders signed in the term, from the <SourceLink id="federal-register-eo">Federal Register</SourceLink>, whose electronic record begins in 1994. Each order has one primary topic, assigned as on the Executive orders page. Counts say how many orders were signed, not how much they did: one order can set up a program or rename an office. A bar is one year in office.
    </p>
  ),
  timeline: (
    <>
      <p>
        The Timeline page&rsquo;s chart cut to this president&rsquo;s years in office, with the hand-picked landmark laws and Supreme Court cases of those years: a short editorial list, not a count. The president&rsquo;s own count of major laws is the card below. The White House row is the president, the Senate and House rows each party&rsquo;s share of seats at the start of each Congress, and the Court row which way its median justice leaned each term (<SourceLink id="martin-quinn">Martin-Quinn scores</SourceLink>, from October 1937). A marker is the day the law was signed or the case decided; tap it for the vote and who held power that day. The Timeline page also has the Court measure by appointing president and the year zoom.
      </p>
      <p>
        A law&rsquo;s votes are each chamber&rsquo;s final roll call, from <SourceLink id="voteview">Voteview</SourceLink>: matched to the law through Congress.gov from 1973, and by hand before then (the last recorded vote approving the bill: its passage, a conference report or agreeing to the other chamber&rsquo;s version). &ldquo;No roll call&rdquo; means that chamber passed it by voice vote or without a recorded vote. Case votes are from the <SourceLink id="scdb">Supreme Court Database</SourceLink> (from 1946; earlier ones typed in by hand).
      </p>
    </>
  ),
  major: (
    <p>
      Laws counted as important enactments, the same list the Laws page uses for its &ldquo;Major law&rdquo; badge, which explains where it comes from. The list does not yet cover a Congress still in session. Each summary is the first sentence of the <SourceLink id="congress-gov">Congressional Research Service</SourceLink> summary, where one stands alone; votes are each chamber&rsquo;s final-passage tally, or how it passed without a recorded vote. Laws before 1973 come from the same David Mayhew lists (1947 on) but are not on the site&rsquo;s law pages, so they show his one-line description; their votes are each chamber&rsquo;s last recorded roll call approving the bill, from <SourceLink id="voteview">Voteview</SourceLink>, matched to the law by hand, and &ldquo;No roll call&rdquo; means the chamber passed it by voice vote or without a recorded vote. A law enacted over a veto, a treaty and a constitutional amendment on his lists are left out.
    </p>
  ),
  misery: (
    <p>
      The misery index adds the unemployment rate to inflation (consumer prices, change from a year earlier) for the same month. Unemployment is the <SourceLink id="fred-unrate">BLS rate</SourceLink>, seasonally adjusted, from 1948; inflation is from the <SourceLink id="fred-cpi">consumer price index</SourceLink>, from 1948. The first reading is the month the president took office, the last the month the term ended. Both are national averages and are revised.
    </p>
  ),
  fiscal: (
    <p>
      The <SourceLink id="fred-deficit">budget balance</SourceLink> is the federal surplus (above zero) or deficit (below) as a share of GDP, by fiscal year (July to June through 1976, October to September since); a year counts for the president in office for most of it, though its budget was usually passed the year before. Debt is <SourceLink id="fred-debt-total">total public debt</SourceLink> as a share of GDP, quarterly from 1966, including debt the government holds in its own trust funds.
    </p>
  ),
  arrivals: (
    <p>
      Green cards are people who became lawful permanent residents in the fiscal year, from the <SourceLink id="ohss-yearbook">DHS Yearbook of Immigration Statistics</SourceLink> (from FY1977). Refugee admissions are from the State Department&rsquo;s <SourceLink id="wraps-admissions">Refugee Processing Center</SourceLink> (from FY1980). A fiscal year counts for the administration in office for most of its days; a hatched bar is preliminary.
    </p>
  ),
  removals: (
    <p>
      Removals are formal deportations: the Immigration and Naturalization Service&rsquo;s through FY2002 (<SourceLink id="ohss-yearbook">DHS Yearbook</SourceLink>) and ICE&rsquo;s own count from FY2003 (<SourceLink id="ice-statistics">ICE</SourceLink>); the two are not the same measure. Border encounters are Border Patrol apprehensions, plus port-of-entry inadmissibles from FY2004 and Title 42 expulsions in FY2020&ndash;23 (<SourceLink id="cbp-encounters">CBP</SourceLink>); they count events, not people. A hatched bar is preliminary.
    </p>
  ),
  trade: (
    <p>
      The goods trade balance is exports minus imports of goods, in billions of dollars a month, seasonally adjusted, on the Census basis, from 1991 (<SourceLink id="census-trade">Census Bureau</SourceLink>). Below zero the U.S. imported more goods than it exported. Services are not included. Dollars are not adjusted for inflation, so later years run larger.
    </p>
  ),
  aid: (
    <p>
      U.S. foreign assistance disbursed in each fiscal year, every country plus regional and global programs, in billions of dollars not adjusted for inflation, from <SourceLink id="foreign-assistance">ForeignAssistance.gov</SourceLink> (from FY2001). The newest year is incomplete until agencies finish reporting and is hatched. The top recipient counts countries only.
    </p>
  ),
  troops: (
    <p>
      Active-duty U.S. military personnel stationed outside the United States and its territories (afloat and unassigned included where the source reports them), one snapshot a year (September; June for 1953&ndash;56), from the <SourceLink id="dmdc">Defense Manpower Data Center</SourceLink>&rsquo;s tables and, for years it did not publish, <SourceLink id="troopdata">troopdata</SourceLink>. The year in progress shows its latest quarter, hatched. From December 2017 DMDC counts permanent assignments only, so later figures leave out most deployed forces.
    </p>
  ),
  spr: (
    <p>
      Crude oil held in the <SourceLink id="eia-spr">Strategic Petroleum Reserve</SourceLink> at the end of each week, in millions of barrels, from the Energy Information Administration (from August 1982). Sales, exchanges and refills are authorized by Congress and the executive branch at different times, and many take months to carry out. The Energy page marks each action.
    </p>
  ),
};

/** The site page each card's data comes from, linked at the end of the card's notes row. */
export const MORE: Record<SeriesCardId | "congress" | "justices" | "laws" | "eos" | "major", { href: string; label: string }> = {
  congress: { href: "/timeline", label: "Timeline" },
  justices: { href: "/supreme-court/justices", label: "Supreme Court" },
  laws: { href: "/congress/laws", label: "All laws" },
  eos: { href: "/presidency/executive-orders", label: "All executive orders" },
  major: { href: "/congress/laws", label: "Laws page" },
  misery: { href: "/presidency/economy", label: "Economy" },
  fiscal: { href: "/presidency/economy", label: "Economy" },
  arrivals: { href: "/presidency/immigration", label: "Immigration" },
  removals: { href: "/presidency/immigration", label: "Immigration" },
  trade: { href: "/presidency/trade", label: "Trade" },
  aid: { href: "/presidency/foreign-aid", label: "Foreign aid" },
  troops: { href: "/presidency/troops-abroad", label: "Troops abroad" },
  spr: { href: "/presidency/energy", label: "Energy" },
};

/** What "major law" means, for the directory's column key and the president page's tile. */
/** Under the major-laws list: what "major" means, and how it differs from the landmark card above it. */
export const MAJOR_LIST_NOTE =
  "The laws named on political scientist David Mayhew\u2019s lists of important enactments, judged from news coverage at the time and later policy studies: the count used across the site. The landmark laws above are a much shorter hand-picked list of the best remembered, shown with the era\u2019s big court cases.";

export const MAJOR_LAW_DEFINITION = "A major law is one that political scientist David Mayhew\u2019s lists of important enactments name, judged from the press at the time and later policy studies. His lists run through the 118th Congress.";
