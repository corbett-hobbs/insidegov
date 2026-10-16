import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import {
  TREASURY_DEBT_API,
  TREASURY_MTS_API,
  quarterEnds,
  rawTreasuryFiscal,
  type RawTreasuryFiscal,
} from "../../lib/treasury-fiscal";
import { RAW_DIR, run } from "./lib";

/**
 * Treasury Fiscal Data (no API key): the newest debt and deficit figures that
 * FRED has not yet published. See `lib/treasury-fiscal.ts` for what is stored
 * and how it is merged. `fetched_at` is carried over while the data is unchanged,
 * so an idle week yields no diff.
 */
const DEST = `${RAW_DIR}/treasury/fiscal.json`;
/** First year of debt rows kept: enough overlap with FRED to cross-check the two. */
const DEBT_FROM_YEAR = 2024;

async function getJson<T>(base: string, params: Record<string, string>): Promise<T> {
  const url = `${base}?${new URLSearchParams(params).toString()}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) return (await res.json()) as T;
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

async function fetchDebt(): Promise<RawTreasuryFiscal["debt"]> {
  const { data } = await getJson<{ data: { record_date: string; debt_held_public_amt: string; tot_pub_debt_out_amt: string }[] }>(TREASURY_DEBT_API, {
    filter: `record_date:gte:${DEBT_FROM_YEAR - 1}-12-01`,
    sort: "record_date",
    "page[size]": "10000",
    fields: "record_date,debt_held_public_amt,tot_pub_debt_out_amt",
  });
  if (data.length === 0) throw new Error("Debt to the Penny returned no rows");
  const newest = data[data.length - 1].record_date;
  const out: RawTreasuryFiscal["debt"] = [];
  for (const qe of quarterEnds(DEBT_FROM_YEAR, newest)) {
    const rec = [...data].reverse().find((r) => r.record_date <= qe);
    if (!rec) throw new Error(`no Debt to the Penny record on or before ${qe}`);
    out.push({ quarter_end: qe, record_date: rec.record_date, total: Number(rec.tot_pub_debt_out_amt), held: Number(rec.debt_held_public_amt) });
  }
  return out;
}

/** The latest September Monthly Treasury Statement carries the finished fiscal year and the one before it. */
async function fetchDeficit(): Promise<RawTreasuryFiscal["deficit"]> {
  const { data } = await getJson<{ data: { record_date: string; line_code_nbr: string; record_fiscal_year: string; current_month_dfct_sur_amt: string }[] }>(
    TREASURY_MTS_API,
    {
      filter: "record_calendar_month:eq:09,classification_desc:eq:Year-to-Date",
      sort: "-record_date",
      "page[size]": "4",
      fields: "record_date,line_code_nbr,record_fiscal_year,current_month_dfct_sur_amt",
    },
  );
  if (data.length === 0) throw new Error("the Monthly Treasury Statement returned no September rows");
  const latest = data[0].record_date;
  const rows = data.filter((r) => r.record_date === latest).sort((a, b) => Number(a.line_code_nbr) - Number(b.line_code_nbr));
  if (rows.length !== 2) throw new Error(`expected the prior and current fiscal year rows for ${latest}, got ${rows.length}`);
  const fy = Number(rows[1].record_fiscal_year);
  return [
    { fiscal_year: fy - 1, record_date: latest, deficit: Number(rows[0].current_month_dfct_sur_amt) },
    { fiscal_year: fy, record_date: latest, deficit: Number(rows[1].current_month_dfct_sur_amt) },
  ];
}

await run("treasury-fiscal", async () => {
  const fresh = rawTreasuryFiscal.parse({ fetched_at: new Date().toISOString(), debt: await fetchDebt(), deficit: await fetchDeficit() });
  if (existsSync(DEST)) {
    const prev = rawTreasuryFiscal.safeParse(JSON.parse(await readFile(DEST, "utf8")));
    if (prev.success && JSON.stringify({ ...prev.data, fetched_at: "" }) === JSON.stringify({ ...fresh, fetched_at: "" })) fresh.fetched_at = prev.data.fetched_at;
  }
  const line = (r: unknown) => `    ${JSON.stringify(r)}`;
  const text = `{\n  "fetched_at": ${JSON.stringify(fresh.fetched_at)},\n  "debt": [\n${fresh.debt.map(line).join(",\n")}\n  ],\n  "deficit": [\n${fresh.deficit.map(line).join(",\n")}\n  ]\n}\n`;
  await mkdir(`${RAW_DIR}/treasury`, { recursive: true });
  await writeFile(`${DEST}.download`, text);
  await rename(`${DEST}.download`, DEST);
  console.log(`  ${DEST}  ${fresh.debt.length} quarter ends (last ${fresh.debt.at(-1)?.quarter_end}), fiscal years ${fresh.deficit.map((d) => d.fiscal_year).join(", ")}`);
});
