import { z } from "zod";

/**
 * Treasury Fiscal Data supplement to the FRED fiscal series. FRED's dollar debt
 * and deficit lag the Treasury's own releases (FRED's fiscal-year deficit waited
 * months for OMB; its quarterly debt waits weeks for the quarter), so the
 * economy page fills the newest period from Treasury until FRED catches up.
 * FRED always wins where it has a value. Raw snapshot:
 * `pipeline/raw/treasury/fiscal.json` (`pnpm fetch:treasury-fiscal`); normalized:
 * `pipeline/output/treasury_fiscal.json`.
 *
 * - Debt: "Debt to the Penny" (daily), the last record on or before each
 *   completed quarter end. FRED dates a quarter at its first day (Q3 = 07-01)
 *   and states the end-of-quarter level; the normalized rows use FRED's dating.
 * - Deficit: the September Monthly Treasury Statement's fiscal-year-to-date
 *   deficit, which is the full fiscal year. Treasury's sign is positive for a
 *   deficit; the output uses FRED's (negative = deficit).
 */
export const TREASURY_DEBT_API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny";
export const TREASURY_MTS_API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_1";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const rawTreasuryFiscal = z.strictObject({
  fetched_at: z.iso.datetime(),
  debt: z.array(
    z.strictObject({
      /** The calendar quarter end the row stands for (Mar 31, Jun 30, Sep 30, Dec 31). */
      quarter_end: isoDate,
      /** The Debt to the Penny record used: the last on or before `quarter_end`. */
      record_date: isoDate,
      /** Dollars. */
      total: z.number().positive(),
      held: z.number().positive(),
    }),
  ),
  deficit: z.array(
    z.strictObject({
      fiscal_year: z.number().int(),
      record_date: isoDate,
      /** Dollars, positive = deficit (Treasury's sign). */
      deficit: z.number(),
    }),
  ),
});
export type RawTreasuryFiscal = z.infer<typeof rawTreasuryFiscal>;

export const treasuryFiscal = z.strictObject({
  fetched_at: z.iso.datetime(),
  /** FRED-style quarter-start date, millions of dollars. */
  debt: z.array(z.strictObject({ date: isoDate, total: z.number(), held: z.number() })),
  /** Fiscal year (the year it ends) and millions of dollars, negative = deficit. */
  deficit: z.array(z.strictObject({ fiscal_year: z.number().int(), value: z.number() })),
});
export type TreasuryFiscal = z.infer<typeof treasuryFiscal>;

/** "2026-09-30" -> "2026-07-01": the first day of the quarter a quarter-end date closes. */
export function quarterStartOfEnd(quarterEnd: string): string {
  const [y, m] = quarterEnd.split("-").map(Number);
  return `${y}-${String(m - 2).padStart(2, "0")}-01`;
}

/** Calendar quarter ends from `fromYear` through the last one on or before `through` (ISO). */
export function quarterEnds(fromYear: number, through: string): string[] {
  const out: string[] = [];
  for (let y = fromYear; y <= Number(through.slice(0, 4)); y++) {
    for (const md of ["03-31", "06-30", "09-30", "12-31"]) if (`${y}-${md}` <= through) out.push(`${y}-${md}`);
  }
  return out;
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Raw dollars -> the FRED-shaped rows the page merges (millions, FRED's dating and sign). */
export function normalizeTreasuryFiscal(raw: RawTreasuryFiscal): TreasuryFiscal {
  return {
    fetched_at: raw.fetched_at,
    debt: raw.debt
      .map((d) => ({ date: quarterStartOfEnd(d.quarter_end), total: round(d.total / 1e6, 0), held: round(d.held / 1e6, 0) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    deficit: raw.deficit
      .map((d) => ({ fiscal_year: d.fiscal_year, value: round(-d.deficit / 1e6, 0) }))
      .sort((a, b) => a.fiscal_year - b.fiscal_year),
  };
}
