import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { normalizeTreasuryFiscal, rawTreasuryFiscal, treasuryFiscal } from "../../lib/treasury-fiscal";

/** raw/treasury/fiscal.json -> output/treasury_fiscal.json. Deterministic: `fetched_at` comes from the snapshot. */
async function main() {
  console.log("transform:treasury-fiscal");
  const raw = rawTreasuryFiscal.parse(JSON.parse(await readFile("pipeline/raw/treasury/fiscal.json", "utf8")));
  const out = treasuryFiscal.parse(normalizeTreasuryFiscal(raw));
  await mkdir("pipeline/output", { recursive: true });
  await writeFile("pipeline/output/treasury_fiscal.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`  ${out.debt.length} quarters (last ${out.debt.at(-1)?.date}), fiscal years ${out.deficit.map((d) => d.fiscal_year).join(", ")}`);
}

main().catch((err: unknown) => {
  console.error("\ntransform:treasury-fiscal FAILED");
  console.error(err instanceof z.ZodError ? z.prettifyError(err) : err instanceof Error ? err.message : err);
  process.exit(1);
});
