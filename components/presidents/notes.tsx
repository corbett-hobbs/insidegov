import Link from "next/link";
import type { ReactNode } from "react";
import { SourceLink } from "@/components/SourceLink";
import type { SeriesCardId } from "@/lib/president-types";

const PAGE = "underline underline-offset-2 hover:text-ink";

/** One "Data notes" paragraph per president-page card (rule 7: what it counts, the caveat a reader could misread, the source). */
export const NOTES: Record<SeriesCardId | "congress" | "justices" | "major" | "eos", ReactNode> & { laws: (through: string) => ReactNode } = {
  congress: (
    <p>
      Each Congress is clipped to the days this president was in office. A chamber&rsquo;s majority is the party that held it for most of those days; seat counts are at the start of the Congress, with independents counted with the party they caucused with. From the <SourceLink id="house-party-division">House</SourceLink> and <SourceLink id="senate-party-division">Senate</SourceLink> historians&rsquo; party divisions, as on the <Link href="/timeline" className={PAGE}>Timeline</Link>.
    </p>
  ),
  justices: (
    <p>
      A justice counts for the president who nominated them (a recess appointment from the day it began, if earlier). An associate justice later made chief by another president, like William Rehnquist, counts as an elevation for the second. Failed and withdrawn nominations are not listed. Dates and Senate votes from the <SourceLink id="fjc">Federal Judicial Center</SourceLink>.
    </p>
  ),
  laws: (through: string) => (
    <p>
      Public laws whose enactment date falls in the term, from <SourceLink id="congress-gov">Congress.gov</SourceLink> (93rd Congress, 1973, on; private laws left out), counted through {through}. A law enacted over a veto is not counted as signed; a bill that became law without a signature is. A bar is one year in office, from the inauguration to the day before its anniversary. Policy areas are the Congressional Research Service&rsquo;s, grouped as on the <Link href="/congress/laws" className={PAGE}>Laws page</Link>.
    </p>
  ),
  eos: (
    <p>
      Executive orders signed in the term, from the <SourceLink id="federal-register-eo">Federal Register</SourceLink>, whose electronic record begins in 1994. Each order has one primary topic, assigned as on the <Link href="/presidency/executive-orders" className={PAGE}>Executive orders page</Link>. Counts say how many orders were signed, not how much they did: one order can set up a program or rename an office. A bar is one year in office.
    </p>
  ),
  major: (
    <p>
      Laws on <SourceLink id="mayhew">David Mayhew&rsquo;s lists</SourceLink> of important enactments, a political scientist&rsquo;s judgment from contemporary press coverage and later assessments. The lists run through the most recent Congress he has assessed, so a Congress still in session has none yet.
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
      Green cards are people who became lawful permanent residents in the fiscal year, from the <SourceLink id="ohss-yearbook">DHS Yearbook of Immigration Statistics</SourceLink> (from FY1977). Refugee admissions are from the State Department&rsquo;s <SourceLink id="wraps-admissions">Refugee Processing Center</SourceLink> (from FY1980). A fiscal year counts for the administration in office for most of its days; a hatched bar is preliminary. More on the <Link href="/presidency/immigration" className={PAGE}>Immigration page</Link>.
    </p>
  ),
  removals: (
    <p>
      Removals are formal deportations: the Immigration and Naturalization Service&rsquo;s through FY2002 (<SourceLink id="ohss-yearbook">DHS Yearbook</SourceLink>) and ICE&rsquo;s own count from FY2003 (<SourceLink id="ice-statistics">ICE</SourceLink>); the two are not the same measure. Border encounters are Border Patrol apprehensions, plus port-of-entry inadmissibles from FY2004 and Title 42 expulsions in FY2020&ndash;23 (<SourceLink id="cbp-encounters">CBP</SourceLink>); they count events, not people. A hatched bar is preliminary.
    </p>
  ),
  trade: (
    <p>
      The goods trade balance is exports minus imports of goods, in billions of dollars a month, seasonally adjusted, on the Census basis, from 1991 (<SourceLink id="census-trade">Census Bureau</SourceLink>). Below zero the U.S. imported more goods than it exported. Services are not included. Dollars are not adjusted for inflation, so later years run larger. More on the <Link href="/presidency/trade" className={PAGE}>Trade page</Link>.
    </p>
  ),
  aid: (
    <p>
      U.S. foreign assistance disbursed in each fiscal year, every country plus regional and global programs, in billions of dollars not adjusted for inflation, from <SourceLink id="foreign-assistance">ForeignAssistance.gov</SourceLink> (from FY2001). The newest year is incomplete until agencies finish reporting and is hatched. The top recipient counts countries only. More on the <Link href="/presidency/foreign-aid" className={PAGE}>Foreign aid page</Link>.
    </p>
  ),
  troops: (
    <p>
      Active-duty U.S. military personnel stationed outside the United States and its territories (afloat and unassigned included where the source reports them), one snapshot a year (September; June for 1953&ndash;56), from the <SourceLink id="dmdc">Defense Manpower Data Center</SourceLink>&rsquo;s tables and, for years it did not publish, <SourceLink id="troopdata">troopdata</SourceLink>. The year in progress shows its latest quarter, hatched. From December 2017 DMDC counts permanent assignments only, so later figures leave out most deployed forces. More on the <Link href="/presidency/troops-abroad" className={PAGE}>Troops abroad page</Link>.
    </p>
  ),
  spr: (
    <p>
      Crude oil held in the <SourceLink id="eia-spr">Strategic Petroleum Reserve</SourceLink> at the end of each week, in millions of barrels, from the Energy Information Administration (from August 1982). Sales, exchanges and refills are authorized by Congress and the executive branch at different times, and many take months to carry out. The <Link href="/presidency/energy" className={PAGE}>Energy page</Link> marks each action.
    </p>
  ),
};
