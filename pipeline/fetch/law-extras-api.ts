import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { rawExtrasFile, RAW_EXTRAS_DIR, type RawLawExtras, rawLawExtras } from "../../lib/law-extras-entities";
import { BILLSTATUS_FIRST_CONGRESS, LAWS_FIRST_CONGRESS, LawsDataError, ordinal, rawCongressFile } from "../../lib/laws-entities";
import { CongressApi, extrasFromApiBill, type ApiAmendment, type ApiCosponsorFull, type ApiRelatedBill, type ApiSummary } from "./congress-gov-lib";
import { formatRawCongress } from "./laws-raw";
import { RAW_DIR, run } from "./lib";

/**
 * The law pages' extra fields for the 93rd-107th Congress (full summary, all actions, amendments, related bills, all cosponsors)
 * from the Congress.gov API -> `pipeline/raw/law-extras/<congress>.json` (needs `CONGRESS_API_KEY`). The 108th on come from the
 * Bill Status ZIPs (`pnpm fetch:billstatus`). The bills are the ones already in `pipeline/raw/congress-gov/<congress>.json`.
 *
 *   pnpm fetch:law-extras                 93rd-107th
 *   pnpm fetch:law-extras -- 99           one Congress
 *   pnpm fetch:law-extras -- --per-second 4
 *
 * Resumable: each bill is cached in `pipeline/raw/_scratch/law-extras/` (gitignored) the moment it arrives, so an interrupted
 * run continues where it stopped. The one-time job is about 40,000 calls (a few hours at 5 a second). Not part of `fetch:all`.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const DIR = `${RAW_DIR}/${RAW_EXTRAS_DIR}`;
const CACHE = `${RAW_DIR}/_scratch/law-extras`;
const WORKERS = 4;

async function writeAtomic(path: string, text: string) {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await writeFile(`${path}.tmp`, text);
  await rename(`${path}.tmp`, path);
}

const count = (j: unknown, key: string): number => ((j as Record<string, { count?: number } | undefined>)[key]?.count ?? 0) as number;

async function fetchBillExtras(api: CongressApi, congress: number, type: string, number: string, lawIds: string[]): Promise<RawLawExtras[]> {
  const base = `/bill/${congress}/${type}/${number}`;
  const detail = ((await api.get(base)) as { bill?: unknown } | null)?.bill;
  if (!detail) throw new LawsDataError(`${base} returned nothing`);
  const list = async (path: string, field: string, n: number) => (n > 0 ? (await api.list(`${base}/${path}`, field)).items : []);
  const actions = await list("actions", "actions", count(detail, "actions"));
  const summaries = ((await api.get(`${base}/summaries`)) as { summaries?: ApiSummary[] } | null)?.summaries ?? [];
  const amendments = await list("amendments", "amendments", count(detail, "amendments"));
  const related = await list("relatedbills", "relatedBills", count(detail, "relatedBills"));
  const cosponsors = await list("cosponsors", "cosponsors", count(detail, "cosponsors"));
  return extrasFromApiBill(lawIds, { actions: actions as never[], summaries, amendments: amendments as ApiAmendment[], related: related as ApiRelatedBill[], cosponsors: cosponsors as ApiCosponsorFull[] }).map((x) => rawLawExtras.parse(x));
}

async function fetchCongress(api: CongressApi, congress: number) {
  const raw = rawCongressFile.parse(JSON.parse(await readFile(`${RAW_DIR}/congress-gov/${congress}.json`, "utf8")));
  const bills = new Map<string, { type: string; number: string; lawIds: string[] }>();
  for (const l of raw.laws) {
    const key = `${l.bill_type}${l.bill_number}`;
    const b = bills.get(key) ?? { type: l.bill_type, number: l.bill_number, lawIds: [] };
    b.lawIds.push(l.law_id);
    bills.set(key, b);
  }
  const results = new Map<string, RawLawExtras[]>();
  const queue = [...bills.entries()];
  let done = 0;
  let cached = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (queue.length > 0) {
        const [key, b] = queue.shift()!;
        const file = `${CACHE}/${congress}/${key}.json`;
        let out: RawLawExtras[] | null = null;
        if (existsSync(file)) {
          out = (JSON.parse(await readFile(file, "utf8")) as unknown[]).map((x) => rawLawExtras.parse(x));
          cached++;
        } else {
          out = await fetchBillExtras(api, congress, b.type, b.number, b.lawIds);
          await writeAtomic(file, JSON.stringify(out));
        }
        results.set(key, out);
        if (++done % 100 === 0) console.log(`    ${ordinal(congress)}: ${done}/${bills.size} bills (${api.calls} calls, ${api.remaining ?? "?"} left this hour)`);
      }
    }),
  );
  const order = new Map(raw.laws.map((l, i) => [l.law_id, i]));
  const laws = [...results.values()].flat().sort((a, b) => order.get(a.law_id)! - order.get(b.law_id)!);
  const file = rawExtrasFile.parse({ source: "congress-gov", congress, fetched: new Date().toISOString().slice(0, 10), laws });
  await writeAtomic(`${DIR}/${congress}.json`, formatRawCongress(file));
  console.log(`  ${ordinal(congress)}: ${laws.length} laws written (${bills.size} bills, ${cached} from the resume cache, ${api.calls} calls so far)`);
}

async function main() {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) throw new LawsDataError("CONGRESS_API_KEY is not set (put it in the environment or .env.local)");
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const ps = args.indexOf("--per-second");
  const perSecond = ps >= 0 ? Number(args[ps + 1]) : 5;
  const wanted = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== "--per-second").map(Number);
  const congresses = wanted.length > 0 ? wanted : Array.from({ length: BILLSTATUS_FIRST_CONGRESS - LAWS_FIRST_CONGRESS }, (_, i) => LAWS_FIRST_CONGRESS + i);
  const api = new CongressApi({ key, perSecond });
  for (const c of congresses) {
    if (c < LAWS_FIRST_CONGRESS || c >= BILLSTATUS_FIRST_CONGRESS) throw new LawsDataError(`${c}: this fetcher covers the ${ordinal(LAWS_FIRST_CONGRESS)}-${ordinal(BILLSTATUS_FIRST_CONGRESS - 1)} Congress; the rest come from fetch:billstatus`);
    await fetchCongress(api, c);
  }
}

run("law-extras", main);
