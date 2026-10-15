import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { z } from "zod";
import { executiveOrder } from "../../lib/executive-orders-entities";
import { cleanOrderText, rawTextUrl } from "./executive-order-texts-lib";
import { RAW_DIR, run } from "./lib";

/**
 * The full text of every executive order in `pipeline/output/executive_orders.json`, from the Federal Register's plain-text
 * rendering (federalregister.gov/documents/full_text/text/..., free, no key, public domain), cut to the order itself by
 * `cleanOrderText`. Feeds `pnpm summarize:eos`. One row per order, sorted by number, one row per line.
 *
 *   pnpm fetch:eo-texts             # only orders with no text yet (the weekly workflow runs this after the transform)
 *   pnpm fetch:eo-texts -- --all    # refetch every order
 *
 * A page that fails or has no "Executive Order N" heading leaves the order out (logged) and it is tried again next run.
 */
export const EO_TEXTS = `${RAW_DIR}/federal-register/executive_order_texts.json`;
export const eoTextRow = z.strictObject({ eo_number: z.number().int(), document_number: z.string().min(1), text: z.string().min(1) });
export type EoTextRow = z.infer<typeof eoTextRow>;
const PARALLEL = 4;

export function readEoTexts(): Map<number, EoTextRow> {
  if (!existsSync(EO_TEXTS)) return new Map();
  return new Map(z.array(eoTextRow).parse(JSON.parse(readFileSync(EO_TEXTS, "utf8"))).map((r) => [r.eo_number, r] as const));
}

async function getText(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (res?.ok) return res.text();
    if (res && res.status !== 429 && res.status < 500) return null;
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return null;
}

if (process.argv[1]?.endsWith("executive-order-texts.ts")) {
  await run("eo-texts", async () => {
    const orders = z.array(executiveOrder).parse(JSON.parse(readFileSync("pipeline/output/executive_orders.json", "utf8")));
    const all = process.argv.includes("--all");
    // --all refetches every order but keeps the stored texts until each is replaced, so a stopped run loses nothing.
    const texts = readEoTexts();
    // A text fetched for a document number the order no longer has (a re-publication) is stale: fetch again.
    const pending = orders.filter((o) => all || texts.get(o.eo_number)?.document_number !== o.document_number);
    const save = async () => {
      const rows = [...texts.values()].sort((a, b) => a.eo_number - b.eo_number);
      await mkdir(`${RAW_DIR}/federal-register`, { recursive: true });
      await writeFile(`${EO_TEXTS}.download`, `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);
      await rename(`${EO_TEXTS}.download`, EO_TEXTS);
    };
    let next = 0;
    let done = 0;
    const missing: number[] = [];
    async function worker() {
      while (next < pending.length) {
        const o = pending[next++]!;
        const page = await getText(rawTextUrl(o.publication_date, o.document_number));
        const text = page ? cleanOrderText(page, o.eo_number) : null;
        if (text) texts.set(o.eo_number, { eo_number: o.eo_number, document_number: o.document_number, text });
        else missing.push(o.eo_number);
        if (++done % 100 === 0) {
          console.log(`  ${done} / ${pending.length}`);
          await save();
        }
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    await save();
    console.log(`  ${EO_TEXTS}  ${texts.size} orders (+${pending.length - missing.length} fetched)`);
    if (missing.length) console.log(`  no text for ${missing.length}: ${missing.sort((a, b) => a - b).join(", ")}`);
  });
}
