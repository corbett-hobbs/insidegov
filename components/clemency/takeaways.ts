import type { ContextEntry } from "@/lib/chart-context";

/** The line under each Pardons card's title (rule 7c). Every figure is checked in lib/clemency-takeaways.test.ts. */
export const CLEMENCY_TAKEAWAYS = {
  hero: {
    title: "Clemency grants per fiscal year",
    takeaway: "Fiscal 2025 shows the most grants since Clinton took office, about 5,700, when Biden’s last months and Trump’s first share a year and group grants are about 5,500 of them. Without group grants the high is 1,186 in fiscal 2017, nearly all from Obama’s last months. From fiscal 1993 through 2015, no year passed 258.",
  },
  presidents: {
    title: "Grants by president",
    takeaway: "Biden’s 4,245 grants are the most of any president shown, with 3,989 on group warrants. Trump has about 1,740 through October 2026, about 1,580 of them by proclamation.",
  },
  outcomes: {
    title: "What happened to petitions",
    takeaway: "Presidents granted 9% of decided petitions under Clinton, 2% under George W. Bush, 7% under Obama and 3% in Trump’s first term, when 8,123 closed without action and 180 were denied. Biden’s 15% includes his group warrants.",
  },
  offenses: {
    title: "What the offenses were",
    takeaway: "Drug offenses were 91% of Obama’s listed grants and 85% of Biden’s. In Trump’s second term they are 17%, behind fraud and financial crimes at 25% and regulatory and environmental offenses at 24%.",
  },
  timing: {
    title: "When in the term",
    takeaway: "Biden made 96% of his grants in his last 90 days and Trump 82% in his first term’s. In Trump’s second term, 97% through October 2026 came in the first year, most of them January 6 grants.",
  },
  age: {
    title: "Years from sentence to pardon",
    takeaway: "The median pardon in Trump’s second term came 2 years after sentencing, through October 2026. From Clinton through Biden, each president’s median is between 12 and 24 years.",
  },
  pending: {
    title: "Petitions waiting",
    takeaway: "Petitions pending at the start of the fiscal year rose from 3,055 in 2008 to a record 17,596 in 2023. They stood at 10,418 when Biden left office, the last figure DOJ has published.",
  },
  list: { title: "Every grant since Clinton" },
} as const;

export const HERO_CONTEXT: ContextEntry = {
  text: "Context: Biden signed group commutation warrants for 1,499 people on Dec 12, 2024 and 2,490 on Jan 17, 2025; Trump’s Jan 20, 2025 proclamation covered about 1,500 January 6 defendants. All three fall in fiscal 2025’s peak.",
  sources: [
    { id: "doj-biden-commutations", label: "DOJ" },
    { id: "fr-proclamation-10887", label: "Federal Register" },
  ],
};
