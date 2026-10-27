import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { factsText } from "./facts";
import type { QuestionSource } from "./questions";

/**
 * Where FAQ answers may come from, and reading those sources as plain text for the drafting model and the checks.
 *
 * The owner's source standard: federal agencies; CRS, CBO and GAO; the Federal Reserve System; universities and extension
 * services; and an industry's own research institute for that industry's operating data, named as such in the label. Not
 * advocacy groups of either side, and not commercial content sites. A host is allowed when it is, or ends in, one of these.
 */
export const ALLOWED_HOSTS: Record<string, string> = {
  // Federal agencies and Congress's support agencies (CRS at congress.gov, CBO, GAO). State and local .gov sites are not listed.
  "bls.gov": "Bureau of Labor Statistics",
  "bea.gov": "Bureau of Economic Analysis",
  "census.gov": "Census Bureau",
  "eia.gov": "Energy Information Administration",
  "energy.gov": "Department of Energy",
  "treasury.gov": "Treasury",
  "usda.gov": "Department of Agriculture",
  "dhs.gov": "Department of Homeland Security",
  "uscis.gov": "U.S. Citizenship and Immigration Services",
  "cbp.gov": "U.S. Customs and Border Protection",
  "ice.gov": "U.S. Immigration and Customs Enforcement",
  "justice.gov": "Department of Justice",
  "state.gov": "Department of State",
  "ustr.gov": "U.S. Trade Representative",
  "usitc.gov": "U.S. International Trade Commission",
  "trade.gov": "International Trade Administration",
  "defense.gov": "Department of Defense",
  "usaid.gov": "USAID",
  "foreignassistance.gov": "ForeignAssistance.gov",
  "federalregister.gov": "Federal Register",
  "govinfo.gov": "GovInfo",
  "uscode.house.gov": "U.S. Code",
  "ecfr.gov": "Code of Federal Regulations",
  "congress.gov": "Congress.gov (incl. CRS)",
  "cbo.gov": "Congressional Budget Office",
  "gao.gov": "Government Accountability Office",
  "ssa.gov": "Social Security Administration",
  "whitehouse.gov": "White House (official documents only)",
  "archives.gov": "National Archives",
  "supremecourt.gov": "Supreme Court",
  "uscourts.gov": "U.S. Courts",
  // The Federal Reserve System.
  "federalreserve.gov": "Federal Reserve Board",
  "stlouisfed.org": "Federal Reserve Bank of St. Louis",
  "newyorkfed.org": "Federal Reserve Bank of New York",
  "frbsf.org": "Federal Reserve Bank of San Francisco",
  "philadelphiafed.org": "Federal Reserve Bank of Philadelphia",
  "clevelandfed.org": "Federal Reserve Bank of Cleveland",
  "chicagofed.org": "Federal Reserve Bank of Chicago",
  "atlantafed.org": "Federal Reserve Bank of Atlanta",
  "dallasfed.org": "Federal Reserve Bank of Dallas",
  "kansascityfed.org": "Federal Reserve Bank of Kansas City",
  "richmondfed.org": "Federal Reserve Bank of Richmond",
  "minneapolisfed.org": "Federal Reserve Bank of Minneapolis",
  "bostonfed.org": "Federal Reserve Bank of Boston",
  // Universities and extension services.
  "edu": "a university or extension service",
  // Industry research institutes, for their own industry's operating data only.
  "truckingresearch.org": "American Transportation Research Institute (trucking industry research)",
};

/** Why a source address is not allowed, or null. */
export function sourceNotAllowed(url: string): string | null {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return `${url} is not https`;
    host = u.hostname.toLowerCase();
  } catch {
    return `${url} is not a web address`;
  }
  const ok = Object.keys(ALLOWED_HOSTS).some((h) => host === h || host.endsWith(`.${h}`));
  return ok ? null : `${host} is not on the allowed source list (federal agencies, CRS/CBO/GAO, the Federal Reserve, universities, named industry research institutes)`;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 insidegov-faq";

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

/** A page's readable text: its <main> when it has one (agency pages wrap a long menu around it), tags and scripts removed. */
export function htmlToText(html: string): string {
  const main = html.match(/<main\b[\s\S]*<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|tr|h[1-6]|td|th)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function pdfToText(buf: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "faq-pdf-"));
  try {
    writeFileSync(join(dir, "s.pdf"), buf);
    return execFileSync("pdftotext", ["-layout", join(dir, "s.pdf"), "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CACHE_DIR = "pipeline/raw/_scratch/faq-sources";

/** The text of one source, fetched now. Throws when the page cannot be read. */
export async function readSource(src: QuestionSource): Promise<string> {
  const parts: string[] = [];
  if (src.facts) parts.push(factsText(src.facts));
  const url = src.fetch ?? src.url;
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/pdf,application/json;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    const buf = Buffer.from(await res.arrayBuffer());
    const text = type.includes("pdf") || url.endsWith(".pdf") ? pdfToText(buf) : type.includes("json") ? JSON.stringify(JSON.parse(buf.toString("utf8")), null, 1) : htmlToText(buf.toString("utf8"));
    if (text.length < 200) throw new Error(`only ${text.length} characters of text`);
    parts.push(text);
  } catch (err) {
    // A facts source still has its figures; the page only adds the agency's wording around them.
    if (!src.facts) throw new Error(`${url}: ${(err as Error).message}`);
  }
  const text = parts.join("\n\n");
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${encodeURIComponent(src.url).slice(0, 180)}.txt`), text);
  return text;
}
