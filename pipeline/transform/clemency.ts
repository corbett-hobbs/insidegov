import { type ClemencyGrant, type ClemencyProclamation, type ClemencyTermId, type ClemencyYear } from "../../lib/clemency-entities";

const ENT: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&#039;": "'", "&quot;": '"', "&rsquo;": "’", "&ndash;": "–", "&sect;": "§", "&lt;": "<", "&gt;": ">" };
export const clean = (h: string) =>
  h.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/gi, (e) => ENT[e] ?? " ").replace(/\s+/g, " ").trim();
const rowsOf = (t: string) => [...t.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
const cellsOf = (r: string) => [...r.matchAll(/<t[dh][\s\S]*?<\/t[dh]>/g)].map((m) => m[0]);
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function isoDate(text: string): string | null {
  const m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  if (!m) return null;
  const mo = MONTHS.indexOf(m[1]!.toLowerCase());
  return mo < 0 ? null : `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
}
/** Federal fiscal year: starts October 1. */
export function fiscalYear(iso: string): number {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return m >= 10 ? y + 1 : y;
}
/** The most recent year in a sentence or date field; dollar amounts don't count. */
export function sentenceYearOf(text: string, grantYear: number): number | null {
  const years = [...text.replace(/\$[\d,.]+/g, " ").matchAll(/(?<![\d,])(19|20)\d\d(?![\d,])/g)].map((m) => Number(m[0])).filter((y) => y <= grantYear);
  return years.length ? Math.max(...years) : null;
}

export interface ParsedRow {
  name: string;
  district: string;
  sentence: string;
  offense: string;
  date: string;
  type: "p" | "c";
  heading: string;
  warrant?: string;
}

/**
 * A recipient page, in any of its formats. Date headings may sit between tables or in a row of one long table; a section's rows are
 * columns under a NAME header (read by the header, since a few sections drop DISTRICT) or labelled rows under a bold name.
 */
export function parseRecipientPage(html: string, pageType: "p" | "c" | "mixed"): ParsedRow[] {
  const body = html.slice(html.indexOf("</h1>"));
  const out: ParsedRow[] = [];
  let heading = "";
  let date: string | null = null;
  let columns: string[] | null = null;
  let current: ParsedRow | null = null;
  let pendingName: string | null = null;
  for (const tok of body.matchAll(/<tr[\s>][\s\S]*?<\/tr>|<h[23][\s>][\s\S]*?<\/h[23]>/g)) {
    const t = tok[0];
    const h = /<h[23][\s>][\s\S]*?<\/h[23]>/.exec(t);
    if (h) {
      const text = clean(h[0]);
      const d = isoDate(text);
      if (d) {
        heading = text;
        date = d;
        columns = null;
        current = null;
      }
      continue;
    }
    if (!date) continue;
    const cells = cellsOf(t);
    const texts = cells.map(clean);
    if (/^NAME/i.test(texts[0] ?? "")) {
      columns = texts.map((x) => x.toUpperCase());
      continue;
    }
    const col = (name: string) => {
      const i = columns?.findIndex((c) => c.startsWith(name)) ?? -1;
      return i >= 0 ? (texts[i] ?? "") : "";
    };
    if (columns) {
      if (texts.length < columns.length) {
        // A second conviction: a short row continuing the person above.
        if (current) {
          const [d, se, of] = columns.includes("DISTRICT") ? texts : ["", ...texts];
          if (d) current.district += ` ${d}`;
          if (se) current.sentence += ` ${se}`;
          if (of) current.offense += ` ${of}`;
        }
        continue;
      }
      const titleAttr = /title="([^"]*)"/.exec(cells[0]!)?.[1] ?? "";
      const link = /href="([^"]*media[^"]*)"/.exec(cells[0]!)?.[1] ?? /href="([^"]*media[^"]*)"/.exec(cells.at(-1)!)?.[1];
      const type = pageType !== "mixed" ? pageType : /commut/i.test(titleAttr) ? "c" : /pardon/i.test(titleAttr) ? "p" : /commutation/i.test(heading) && !/pardon/i.test(heading) ? "c" : "p";
      // One warrant can name several people in one cell, each on its own line.
      const names = cells[0]!.split(/<br\s*\/?>|<\/p>/i).map(clean).filter(Boolean);
      for (const name of names) {
        current = { date, heading, name, district: col("DISTRICT"), sentence: col("SENTENCED"), offense: col("OFFENSE"), type, warrant: link };
        out.push(current);
      }
      continue;
    }
    if (texts.length < 2) continue;
    const label = texts[0]!.replace(/:$/, "").toLowerCase();
    const v = texts[1] ?? "";
    if (label === "" && /^\d+\./.test(v)) {
      if (current) current.sentence = `${current.sentence} ${v}`.trim();
    } else if (label === "" && /<(strong|b)[\s>]/.test(cells[1] ?? "") && v) {
      current = { date, heading, name: v, district: "", sentence: "", offense: "", type: pageType === "mixed" ? "p" : pageType };
      out.push(current);
      pendingName = null;
    } else if (label === "" && v && !/^\d+\./.test(v)) {
      // A few names lost their bold; one counts only if an Offense row follows.
      pendingName = v;
    } else if (label.startsWith("offense") || current) {
      if (label.startsWith("offense") && pendingName) {
        current = { date, heading, name: pendingName, district: "", sentence: "", offense: "", type: pageType === "mixed" ? "p" : pageType };
        out.push(current);
      }
      pendingName = null;
      if (!current) continue;
      if (label.startsWith("offense")) {
      const d = /\(([^()]*(?:District|Circuit|Court|Army|Navy|Air Force|Marine)[^()]*)\)\s*$/.exec(v);
      current.offense = current.offense ? `${current.offense}; ${v}` : v;
      if (d && !current.district) current.district = d[1]!;
      } else if (label.startsWith("district")) {
        current.district = v.split(";")[0]!.trim();
        current.sentence = `${current.sentence} (${v.split(";").slice(1).join(";").trim()})`.trim();
      } else if (label.startsWith("sentence")) {
        current.sentence = `${v} ${current.sentence}`.trim();
      }
    }
  }
  return out;
}

/** Amended warrants: a later warrant under an "(Amended)" heading for someone already listed that term is listed but not counted again. */
export function markAmended(rows: readonly ClemencyGrant[], headings: Map<string, string>): ClemencyGrant[] {
  const key = (r: ClemencyGrant) => `${r.term}|${r.type}|${r.name.toLowerCase().replace(/[^a-z]/g, "")}`;
  const first = new Map<string, string>();
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) if (!first.has(key(r))) first.set(key(r), r.date);
  return rows.map((r) => (/amended/i.test(headings.get(r.id) ?? "") && first.get(key(r))! < r.date ? { ...r, amended: true } : r));
}

export interface StatYear {
  fy: number;
  term: ClemencyTermId;
  pendingP: number;
  pendingC: number;
  receivedP: number;
  receivedC: number;
  grantedP: number;
  grantedC: number;
  respites: number;
  deniedP: number;
  deniedC: number;
  closedP: number;
  closedC: number;
  endPending: number | null;
}
const STAT_SECTIONS: [string, ClemencyTermId][] = [["Joseph R. Biden", "biden"], ["Donald J. Trump", "trump1"], ["Barack H. Obama", "obama"], ["George W. Bush", "bush43"], ["William J. Clinton", "clinton"]];
const num = (s: string) => Number(s.replace(/[^\d]/g, "") || 0);

/** `clemency-statistics`: each table is one president, one row per fiscal year (13 columns where DOJ adds end-of-month pending). */
export function parseStatistics(html: string): StatYear[] {
  const out: StatYear[] = [];
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/g)];
  for (const t of tables) {
    const before = clean(html.slice(Math.max(0, t.index - 400), t.index));
    const term = STAT_SECTIONS.find(([n]) => before.endsWith(n))?.[1];
    if (!term) continue;
    for (const r of rowsOf(t[0])) {
      const c = cellsOf(r).map(clean);
      if (!/^\d{4}\b/.test(c[0] ?? "")) continue;
      const v = c.slice(1).map(num);
      const wide = v.length >= 13;
      const o = wide ? 2 : 0;
      out.push({
        fy: Number(c[0]!.slice(0, 4)), term, pendingP: v[0]!, pendingC: v[1]!, receivedP: v[o + 2]!, receivedC: v[o + 3]!, grantedP: v[o + 4]!, grantedC: v[o + 5]!, respites: v[o + 6]!, deniedP: v[o + 7]!, deniedC: v[o + 8]!, closedP: v[o + 9]!, closedC: v[o + 10]!,
        endPending: wide ? v[2]! + v[3]! : null,
      });
    }
  }
  return out;
}

const titleCase = (t: string) =>
  t.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, (x) => x.toUpperCase()).trim();

export interface WarrantDetail {
  name: string;
  reg: string;
  district: string;
  sentenced: string;
  months: string;
  statutes: string;
}
/** The disclosure table for one Jan 17 warrant: surname, first name, register number, district, docket, date, sentence, statutes. */
export function parseWarrantDetails(text: string): WarrantDetail[] {
  const out: WarrantDetail[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*(\S.*?)\s{2,}(\S.*?)\s+(\d{5}-\d{3})\s.*?\b([A-Z]{2,3})\s+\S+\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+|LIFE)\s+(.*)$/.exec(line);
    if (!m) continue;
    out.push({ name: titleCase(`${m[2]} ${m[1]}`), reg: m[3]!, district: m[4]!, sentenced: m[5]!, months: m[6]!, statutes: m[7]!.trim().replace(/\s{2,}/g, "; ").replace(/(\d)\s+(1\d|2\d) USC/g, "$1; $2 USC") });
  }
  return out;
}

/** Fiscal-year rows: DOJ's statistics through January 2025 (Biden's group warrants split out), then counted from the current term's list. */
export function buildYears(stats: readonly StatYear[], grants: readonly ClemencyGrant[], procs: readonly ClemencyProclamation[], bidenGroup: { fy: number; people: number }[]): ClemencyYear[] {
  const years: ClemencyYear[] = stats.map((s) => {
    const group = bidenGroup.filter((g) => s.term === "biden" && g.fy === s.fy).reduce((n, g) => n + g.people, 0);
    return { fy: s.fy, term: s.term, pardons: s.grantedP, commutations: s.grantedC - group, group, respites: s.respites, received: s.receivedP + s.receivedC, denied: s.deniedP + s.deniedC, closed: s.closedP + s.closedC, pendingStart: s.pendingP + s.pendingC, source: "doj-statistics" };
  });
  const now = grants.filter((g) => g.term === "trump2" && !g.amended && g.people == null);
  const fys = new Set([...now.map((g) => g.fy), ...procs.filter((p) => p.term === "trump2").map((p) => fiscalYear(p.date))]);
  for (const fy of [...fys].sort()) {
    const here = now.filter((g) => g.fy === fy);
    const group = procs.filter((p) => p.term === "trump2" && fiscalYear(p.date) === fy).reduce((n, p) => n + (p.people ?? 0), 0);
    years.push({ fy, term: "trump2", pardons: here.filter((g) => g.type === "p").length, commutations: here.filter((g) => g.type === "c").length, group, respites: 0, received: null, denied: null, closed: null, pendingStart: null, source: "doj-list" });
  }
  return years.sort((a, b) => a.fy - b.fy || a.term.localeCompare(b.term));
}
