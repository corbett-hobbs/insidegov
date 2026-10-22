/**
 * What each Supreme Court Database issue area holds, in a sentence or two, for the Issue area dropdown's ⓘ, the heatmap and
 * row tooltips and the page's "How to read this". One entry per area id in `pipeline/reference/decision-issue-areas.json`;
 * paraphrased from the codebook's issue-area definitions (http://scdb.wustl.edu/documentation.php?var=issueArea). The database
 * gives each case exactly one area, its main issue, so an area names what a case was mainly about, not everything it touched.
 */
export const ISSUE_AREA_DESCRIPTIONS: Record<string, string> = {
  "criminal-procedure": "Rights of people accused or convicted of a crime: searches and seizures, self-incrimination, the right to a lawyer, jury trials, sentencing, the death penalty and habeas corpus.",
  "civil-rights": "Claims of discrimination by race, sex, age, disability or other status, plus voting rights, desegregation, affirmative action, and the rights of immigrants and Native Americans.",
  "first-amendment": "Free speech, press and assembly, the separation of church and state, the free exercise of religion, and campaign finance.",
  "due-process": "Fair-procedure claims outside criminal cases, such as hearings before the government takes something away, plus property takings and vague or retroactive laws.",
  privacy: "Abortion, contraception, the right to die, personal information, and public-records disclosure under the Freedom of Information Act.",
  attorneys: "Lawyers’ fees, bar admission and discipline, and rules for how lawyers advertise and practice.",
  unions: "Labor law: union organizing, collective bargaining, strikes, and workers’ claims against employers.",
  "economic-activity": "Business and commercial disputes: antitrust, securities, bankruptcy, patents, consumer protection, the environment, insurance, pensions, and injury (tort) claims.",
  "judicial-power": "How federal courts work: who can sue (standing), which court hears a case, review of agency actions, class actions and filing deadlines.",
  federalism: "The balance between federal and state power, such as when federal law overrides state law and when states can tax or regulate, plus some president-versus-Congress disputes.",
  "interstate-relations": "Disputes between states, such as borders, water rights and compacts, which the Court hears directly.",
  "federal-taxation": "Federal income, estate and excise tax law, including IRS collection and liens.",
  miscellaneous: "Cases that fit nowhere else, mostly separation-of-powers questions such as the legislative veto and political questions.",
  "private-action": "Disputes between private parties over property, contracts, wills and similar matters, where the government isn’t a party.",
};
