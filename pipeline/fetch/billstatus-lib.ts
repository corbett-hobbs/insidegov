import { inflateRawSync } from "node:zlib";
import { BILL_TYPES, type BillType, type RawAction, type RawLaw } from "../../lib/laws-entities";
import type { RawBill, RawBillAction } from "../../lib/committee-bills-entities";
import { AMENDMENT_PURPOSE_CAP, type RawAmendment, type RawCosponsorRecord, type RawLawExtras, type RawRelatedBill } from "../../lib/law-extras-entities";
import { becameLawDates, isoDay, normaliseCommittees, keepAction, lawId, parsePublicLawNumber, pickSummary, slimActions, type SummaryVersion } from "./laws-raw";

/**
 * GovInfo Bill Status bulk data (https://www.govinfo.gov/bulkdata/BILLSTATUS): from the 108th Congress, one ZIP per
 * bill type per Congress, one XML file per bill. This file reads those ZIPs and turns each bill that became a public law
 * into the same `RawLaw` the Congress.gov API fetcher produces. No XML or zip dependency, as with `transform/xlsx.ts`.
 */
export const BILLSTATUS_BASE = "https://www.govinfo.gov/bulkdata/BILLSTATUS";
/** Bill types that can become a public law. (hconres, hres, sconres and sres cannot.) */
export const LAW_BILL_TYPES: readonly BillType[] = BILL_TYPES;

export const zipUrl = (congress: number, type: BillType) => `${BILLSTATUS_BASE}/${congress}/${type}/BILLSTATUS-${congress}-${type}.zip`;
export const zipName = (congress: number, type: BillType) => `BILLSTATUS-${congress}-${type}.zip`;

/** Iterate the entries of a zip (stored or deflated), inflating each one only when it is reached. */
export function* zipEntries(buf: Buffer): Generator<{ name: string; data: () => Buffer }> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip file (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (method !== 0 && method !== 8) throw new Error(`zip entry ${name}: unsupported compression method ${method}`);
    yield { name, data: () => (method === 8 ? inflateRawSync(buf.subarray(dataStart, dataStart + compSize)) : buf.subarray(dataStart, dataStart + compSize)) };
    p += 46 + nameLen + extraLen + commentLen;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decodeXml = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);

/** Text of the first `<tag>` in `xml`, entity-decoded and trimmed; null when absent or empty. */
export function tagText(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!m) return null;
  const t = decodeXml(m[1]!.trim());
  return t === "" ? null : t;
}

/**
 * The HTML inside a summary's `<text>`. Bill Status wraps it two ways: from about the 117th as entity-escaped text inside `<cdata>`,
 * and in the older files as a CDATA section directly under `<summary>`. Either way the result is the HTML itself.
 */
export function summaryHtml(summaryXml: string): string {
  const raw = /<text>([\s\S]*?)<\/text>/.exec(summaryXml)?.[1] ?? "";
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(raw);
  return (cdata ? cdata[1]! : decodeXml(raw)).trim();
}

/** The inner XML of the first `<tag>…</tag>` block, or "". */
export function block(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? m[1]! : "";
}

/** The inner XML of each top-level `<item>` of `<tag>` (items may nest: a committee holds subcommittee items). */
function items(xml: string, tag: string): string[] {
  const body = block(xml, tag);
  const out: string[] = [];
  const re = /<(\/?)item>/g;
  let depth = 0;
  let start = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m[1] === "") {
      if (depth === 0) start = m.index + m[0].length;
      depth++;
    } else if (--depth === 0) out.push(body.slice(start, m.index));
  }
  return out;
}

const NESTED_WITH_TYPE = ["actions", "laws", "committees", "relatedBills", "titles", "textVersions", "committeeReports", "cboCostEstimates", "notes", "subjects", "summaries", "sponsors", "cosponsors", "amendments", "policyArea", "latestAction"];

/** Remove blocks whose children reuse tag names (`type`, `number`, `name`, `text`) so bill-level lookups see only the bill's own. */
function topLevel(billXml: string): string {
  let s = billXml;
  for (const t of NESTED_WITH_TYPE) s = s.replace(new RegExp(`<${t}>[\\s\\S]*?</${t}>`, "g"), "");
  return s;
}

/** `<activities>` of a committee or subcommittee item; the direct ones only (a committee's own block precedes nothing nested after stripping subcommittees). */
function bulkActivities(itemXml: string): { name: string | null; date: string | null }[] {
  const own = itemXml.replace(/<subcommittees>[\s\S]*?<\/subcommittees>/, "");
  return items(own, "activities").map((a) => ({ name: tagText(a, "name"), date: isoDay(tagText(a, "date")) }));
}

const chamberOf = (s: string | null): "House" | "Senate" | null => (s === "House" || s === "Senate" ? s : null);

/**
 * Parse one Bill Status file. Returns one `RawLaw` per public-law number the bill carries (almost always one),
 * or [] when the bill never became a public law.
 */
export function parseBillStatus(xml: string, corrections?: string[]): RawLaw[] {
  return parseBillStatusWithExtras(xml, corrections).map((x) => x.law);
}

const oneLine = (s: string, cap: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > cap ? t.slice(0, cap - 1) + "…" : t;
};

/** Amendments the bill lists (`<amendments>`); each carries its own sponsor, dates and actions, which are the amendment's, not the bill's. */
export function parseAmendments(amendmentsXml: string): RawAmendment[] {
  const out: RawAmendment[] = [];
  for (const m of amendmentsXml.matchAll(/<amendment>([\s\S]*?)<\/amendment>/g)) {
    const a = m[1]!;
    // Strip nested blocks that reuse tag names, so the lookups below see only the amendment's own.
    const own = ["sponsors", "cosponsors", "actions", "amendedBill", "amendedAmendment", "amendmentsToAmendment", "latestAction", "links"].reduce((x, t) => x.replace(new RegExp(`<${t}>[\\s\\S]*?</${t}>`, "g"), ""), a);
    const chamber = /^House/.test(tagText(own, "chamber") ?? "") ? "House" : /^Senate/.test(tagText(own, "chamber") ?? "") ? "Senate" : null;
    const type = tagText(own, "type");
    const number = tagText(own, "number");
    if (!chamber || !type || !number || !/^\d+$/.test(number)) continue;
    const sponsor = items(a, "sponsors")[0];
    const id = sponsor ? tagText(sponsor, "bioguideId") : null;
    const name = sponsor ? (tagText(sponsor, "fullName") ?? tagText(sponsor, "name")) : null;
    const latestXml = block(a, "latestAction");
    let latest = latestXml ? { date: isoDay(tagText(latestXml, "actionDate")), text: tagText(latestXml, "text") ?? "" } : null;
    if (!latest || latest.text === "") {
      // No latestAction: take the newest of the amendment's own actions (the list is not reliably ordered).
      const acts = items(a, "actions")
        .map((it) => ({ date: isoDay(tagText(it, "actionDate")), text: tagText(it, "text") ?? "" }))
        .filter((x) => x.text !== "");
      acts.sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""));
      latest = acts[0] ?? null;
    }
    const purpose = tagText(own, "purpose");
    out.push({
      chamber,
      type,
      number,
      sponsor: id && /^[A-Z]\d{6}$/.test(id) ? id : null,
      sponsor_name: name ? oneLine(name, 120) : null,
      submitted: isoDay(tagText(own, "submittedDate")),
      purpose: purpose ? oneLine(purpose, AMENDMENT_PURPOSE_CAP) : null,
      latest: latest ? { date: latest.date, text: oneLine(latest.text, 200) } : null,
    });
  }
  return out;
}

/** Bills the source relates to this one, with the relationship names (CRS's, the House's, the Senate's), de-duplicated and sorted. */
export function parseRelatedBills(bill: string): RawRelatedBill[] {
  const out: RawRelatedBill[] = [];
  for (const it of items(bill, "relatedBills")) {
    const bare = it.replace(/<relationshipDetails>[\s\S]*?<\/relationshipDetails>/, "").replace(/<latestAction>[\s\S]*?<\/latestAction>/, "");
    const congress = Number(tagText(bare, "congress"));
    const type = tagText(bare, "type");
    const number = tagText(bare, "number");
    if (!Number.isInteger(congress) || !type || !number || !/^\d+$/.test(number)) continue;
    const rel = [...new Set(items(it, "relationshipDetails").flatMap((r) => tagText(r, "type") ?? []))].sort();
    out.push({ congress, type: type.toUpperCase(), number, title: oneLine(tagText(bare, "title") ?? "", 220), rel });
  }
  return out.sort((a, b) => a.congress - b.congress || a.type.localeCompare(b.type) || Number(a.number) - Number(b.number));
}

/** Every cosponsor with the date they joined, whether an original cosponsor, and the date they withdrew (null when they did not). */
export function parseCosponsorRecords(bill: string): RawCosponsorRecord[] {
  return items(bill, "cosponsors").flatMap((it) => {
    const id = tagText(it, "bioguideId");
    if (!id || !/^[A-Z]\d{6}$/.test(id)) return [];
    return [{ id, date: isoDay(tagText(it, "sponsorshipDate")), original: tagText(it, "isOriginalCosponsor")?.toLowerCase() === "true", withdrawn: isoDay(tagText(it, "sponsorshipWithdrawnDate")) }];
  });
}

/** Every action the source lists, as `RawAction`s (no filter): introduction, committee, floor, presidential. */
export function parseAllActions(bill: string): RawAction[] {
  return slimActions(
    items(bill, "actions").flatMap((it) => {
      const date = isoDay(tagText(it, "actionDate"));
      const text = tagText(it, "text") ?? "";
      if (!date || text === "") return [];
      const votes = [...block(it, "recordedVotes").matchAll(/<recordedVote>([\s\S]*?)<\/recordedVote>/g)].flatMap((m) => {
        const ch = chamberOf(tagText(m[1]!, "chamber"));
        const roll = Number(tagText(m[1]!, "rollNumber"));
        if (!ch || !Number.isInteger(roll)) return [];
        const session = tagText(m[1]!, "sessionNumber");
        return [{ chamber: ch, roll, session: session === null ? null : Number(session), date: isoDay(tagText(m[1]!, "date")) }];
      });
      const src = tagText(block(it, "sourceSystem"), "code");
      return [{ date, type: tagText(it, "type") ?? "", text, src: src === null ? null : Number(src), ...(votes.length > 0 ? { votes } : {}) }];
    }),
  );
}

/** The law plus the extra fields the law pages read (full summary, all actions, amendments, related bills, all cosponsors). */
export function parseBillStatusWithExtras(xml: string, corrections?: string[]): { law: RawLaw; extras: RawLawExtras }[] {
  if (!xml.includes("<type>Public Law</type>")) return [];
  const fullBill = block(xml, "bill");
  // Amendments carry their own sponsors, cosponsors, actions and types; they are not the bill's.
  const bill = fullBill.replace(/<amendments>[\s\S]*?<\/amendments>/g, "");
  const lawNumbers = items(bill, "laws")
    .filter((it) => tagText(it, "type") === "Public Law")
    .map((it) => parsePublicLawNumber(tagText(it, "number") ?? ""))
    .filter((x): x is [number, number] => x !== null);
  if (lawNumbers.length === 0) return [];

  const top = topLevel(bill);
  // A bill can only become a law of its own Congress. Bill Status has a few typos in the Congress part of the law number
  // (110th S. 2499 lists 108-173, which is Public Law 110-173); read the Congress from the bill and report the correction.
  const billCongress = Number(tagText(top, "congress"));
  const type = (tagText(top, "type") ?? "").toLowerCase();
  if (!(LAW_BILL_TYPES as readonly string[]).includes(type)) throw new Error(`bill type "${type}" cannot become a public law`);
  const number = tagText(top, "number") ?? "";
  const sponsorItem = items(bill, "sponsors")[0];

  const actions: RawAction[] = items(bill, "actions").flatMap((it) => {
    const date = isoDay(tagText(it, "actionDate"));
    const atype = tagText(it, "type") ?? "";
    const text = tagText(it, "text") ?? "";
    if (!date) return [];
    const votes = [...block(it, "recordedVotes").matchAll(/<recordedVote>([\s\S]*?)<\/recordedVote>/g)].flatMap((m) => {
      const ch = chamberOf(tagText(m[1]!, "chamber"));
      const roll = Number(tagText(m[1]!, "rollNumber"));
      if (!ch || !Number.isInteger(roll)) return [];
      const session = tagText(m[1]!, "sessionNumber");
      return [{ chamber: ch, roll, session: session === null ? null : Number(session), date: isoDay(tagText(m[1]!, "date")) }];
    });
    if (!keepAction(atype, text, votes.length > 0)) return [];
    const src = tagText(block(it, "sourceSystem"), "code");
    return [{ date, type: atype, text, src: src === null ? null : Number(src), ...(votes.length > 0 ? { votes } : {}) }];
  });

  const versions: SummaryVersion[] = [...block(bill, "summaries").matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => ({
    stage: tagText(m[1]!, "actionDesc"),
    date: isoDay(tagText(m[1]!, "actionDate")),
    html: summaryHtml(m[1]!),
  }));
  const summary = pickSummary(versions);
  const committees = normaliseCommittees(
    items(bill, "committees").map((it) => ({
      code: tagText(it, "systemCode"),
      name: tagText(it, "name"),
      chamber: tagText(it, "chamber"),
      activities: bulkActivities(it),
      subcommittees: items(it, "subcommittees").map((sub) => ({ code: tagText(sub, "systemCode"), name: tagText(sub, "name"), activities: bulkActivities(sub) })),
    })),
  );
  const slim = slimActions(actions);

  // Correct the Congress part, then keep each law once (the bill may list both the typo and the right number).
  const corrected = new Map<string, [number, number]>();
  for (const [cited, n] of lawNumbers) {
    const c = Number.isInteger(billCongress) && billCongress > 0 ? billCongress : cited;
    if (c !== cited) corrections?.push(`${lawId(c, n)}: Bill Status also lists ${cited}-${n} on ${type.toUpperCase()} ${number} of Congress ${c}; read as ${c}-${n}`);
    corrected.set(lawId(c, n), [c, n]);
  }
  const extrasBody = {
    summary_html: pickSummary(versions, Infinity)?.html ?? null,
    actions: parseAllActions(bill),
    amendments: parseAmendments(block(fullBill, "amendments")),
    related: parseRelatedBills(bill),
    cosponsors: parseCosponsorRecords(bill),
  };
  return [...corrected.values()].map(([c, n]) => {
    const law: RawLaw = {
    law_id: lawId(c, n),
    congress: c,
    number: n,
    bill_type: type as BillType,
    bill_number: number,
    origin_chamber: chamberOf(tagText(top, "originChamber")),
    title: tagText(top, "title") ?? tagText(block(bill, "titles"), "title") ?? "",
    introduced: isoDay(tagText(top, "introducedDate")),
    sponsor: sponsorItem ? tagText(sponsorItem, "bioguideId") : null,
    sponsor_name: sponsorItem ? tagText(sponsorItem, "fullName") : null,
    cosponsors: items(bill, "cosponsors")
      .filter((it) => tagText(it, "sponsorshipWithdrawnDate") === null)
      .flatMap((it) => {
        const id = tagText(it, "bioguideId");
        return id ? [id] : [];
      }),
    policy_area: tagText(block(bill, "policyArea"), "name"),
    summary_html: summary?.html ?? null,
    summary_stage: summary?.stage ?? null,
    became_law: becameLawDates(slim),
    latest_action_date: isoDay(tagText(block(bill, "latestAction"), "actionDate")),
    updated: isoDay(tagText(top, "updateDate")),
    actions: slim,
    committees,
    };
    return { law, extras: { law_id: law.law_id, ...extrasBody } };
  });
}

/**
 * Two bills can claim one public-law number while a law is pending (the 119th lists 119-120 on both H.R. 766, unsigned, and S. 766, signed).
 * Keep the claim that carries a signing date and report the other as a correction; two signed claims are left for the transform to reject.
 */
export function dropUnsignedClaims<T extends { law: RawLaw }>(entries: T[], corrections: string[]): T[] {
  const byId = new Map<string, T[]>();
  for (const e of entries) byId.set(e.law.law_id, [...(byId.get(e.law.law_id) ?? []), e]);
  const drop = new Set<T>();
  for (const [id, list] of byId) {
    const signed = list.filter((e) => e.law.became_law.length > 0);
    if (list.length < 2 || signed.length !== 1) continue;
    for (const e of list) {
      if (e === signed[0]) continue;
      drop.add(e);
      corrections.push(`${id}: Bill Status also lists it on ${e.law.bill_type.toUpperCase()} ${e.law.bill_number}, which has no signing action; kept ${signed[0]!.law.bill_type.toUpperCase()} ${signed[0]!.law.bill_number}`);
    }
  }
  return entries.filter((e) => !drop.has(e));
}

/** Read every bill in one Bill Status ZIP; returns the public-law records (and their page extras) and how many bills the ZIP held. */
export function lawsFromZip(zip: Buffer): { laws: RawLaw[]; extras: RawLawExtras[]; bills: number; corrections: string[] } {
  const laws: RawLaw[] = [];
  const extras: RawLawExtras[] = [];
  const corrections: string[] = [];
  let bills = 0;
  for (const e of zipEntries(zip)) {
    if (!e.name.endsWith(".xml")) continue;
    bills++;
    for (const x of parseBillStatusWithExtras(e.data().toString("utf8"), corrections)) {
      laws.push(x.law);
      extras.push(x.extras);
    }
  }
  return { laws, extras, bills, corrections };
}

// ---- every bill of a Congress, as a digest for the committee pages ----------------------------------------------------

/** A committee step the stage logic reads from the action text: a mark-up, or "ordered to be reported" (with its vote tally). */
const COMMITTEE_STEP = /mark-?up|ordered to be reported|ordered reported/i;
const PASSAGE = /passed\/agreed to in (house|senate)/i;
const BILL_ACTION_TEXT_CAP = 200;

/**
 * Keep an action only when the stage logic reads it: a committee mark-up or "ordered to be reported" (text kept, for the
 * vote tally), a calendar placement (date only), a chamber passage (the matched phrase only) a veto or the signing (type only).
 */
export function slimBillAction(type: string, text: string, committees: string[]): Omit<RawBillAction, "date"> | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (COMMITTEE_STEP.test(t)) return { type, text: t.length > BILL_ACTION_TEXT_CAP ? t.slice(0, BILL_ACTION_TEXT_CAP - 1) + "…" : t, committees };
  if (type === "Calendars") return { type, text: "", committees: [] };
  const passed = PASSAGE.exec(t);
  if (passed) return { type, text: `Passed/agreed to in ${passed[1]![0]!.toUpperCase()}${passed[1]!.slice(1).toLowerCase()}`, committees: [] };
  if (type === "Veto" || type === "BecameLaw") return { type, text: "", committees: [] };
  // Older files type the signing as a President action; the Laws track reads it the same way (`becameLawDates`).
  if (type === "President" && /became public law/i.test(t)) return { type, text: "Became Public Law", committees: [] };
  return null;
}

/** A Bill Status file -> the digest the committee pages read; null for a type that cannot be a bill or joint resolution. */
export function parseBillDigest(xml: string): RawBill | null {
  const bill = block(xml, "bill").replace(/<amendments>[\s\S]*?<\/amendments>/g, "");
  const top = topLevel(bill);
  const type = (tagText(top, "type") ?? "").toLowerCase();
  if (!(LAW_BILL_TYPES as readonly string[]).includes(type)) return null;
  const sponsorItem = items(bill, "sponsors")[0];
  const sponsorId = sponsorItem ? tagText(sponsorItem, "bioguideId") : null;
  const sponsorName = sponsorItem ? tagText(sponsorItem, "fullName") : null;
  const cosponsors: [number, number, number] = [0, 0, 0];
  for (const it of items(bill, "cosponsors")) {
    if (tagText(it, "sponsorshipWithdrawnDate") !== null) continue;
    const party = tagText(it, "party");
    cosponsors[party === "D" ? 0 : party === "R" ? 1 : 2]++;
  }
  const seen = new Set<string>();
  const actions: RawBillAction[] = [];
  for (const it of items(bill, "actions")) {
    const date = isoDay(tagText(it, "actionDate"));
    if (!date) continue;
    const codes = items(it, "committees").flatMap((c) => {
      const code = tagText(c, "systemCode");
      return code ? [code.toLowerCase()] : [];
    });
    const kept = slimBillAction(tagText(it, "type") ?? "", tagText(it, "text") ?? "", codes);
    if (!kept) continue;
    const key = `${date}|${kept.type}|${kept.text}|${kept.committees.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ date, ...kept });
  }
  actions.sort((a, b) => a.date.localeCompare(b.date));
  const latestXml = block(bill, "latestAction");
  const latestDate = isoDay(tagText(latestXml, "actionDate"));
  const latestText = (tagText(latestXml, "text") ?? "").replace(/\s+/g, " ").trim();
  const origin = tagText(top, "originChamber");
  return {
    type: type as BillType,
    number: tagText(top, "number") ?? "",
    title: tagText(top, "title") ?? "",
    introduced: isoDay(tagText(top, "introducedDate")),
    origin_chamber: origin === "House" || origin === "Senate" ? origin : null,
    sponsor: sponsorId && sponsorName ? { id: sponsorId, name: sponsorName } : null,
    cosponsors,
    policy_area: tagText(block(bill, "policyArea"), "name"),
    committees: normaliseCommittees(
      items(bill, "committees").map((it) => ({
        code: tagText(it, "systemCode"),
        name: tagText(it, "name"),
        chamber: tagText(it, "chamber"),
        activities: bulkActivities(it),
        subcommittees: items(it, "subcommittees").map((sub) => ({ code: tagText(sub, "systemCode"), name: tagText(sub, "name"), activities: bulkActivities(sub) })),
      })),
    ),
    actions,
    laws: items(bill, "laws").flatMap((it) => (tagText(it, "type") === "Public Law" ? [tagText(it, "number") ?? ""] : [])).filter((n) => /^\d+-\d+$/.test(n)),
    reports: [...block(bill, "committeeReports").matchAll(/<committeeReport>([\s\S]*?)<\/committeeReport>/g)].flatMap((m) => {
      const c = tagText(m[1]!, "citation");
      return c ? [c] : [];
    }),
    cbo_estimates: items(bill, "cboCostEstimates").length,
    latest_action: latestDate ? { date: latestDate, text: latestText.length > 160 ? latestText.slice(0, 159) + "…" : latestText } : null,
    updated: isoDay(tagText(top, "updateDate")),
  };
}

/** Every bill in one Bill Status ZIP, digested; sorted by number so a re-run diffs cleanly. */
export function billsFromZip(zip: Buffer): RawBill[] {
  const out: RawBill[] = [];
  for (const e of zipEntries(zip)) {
    if (!e.name.endsWith(".xml")) continue;
    const b = parseBillDigest(e.data().toString("utf8"));
    if (b) out.push(b);
  }
  return out.sort((a, b) => a.type.localeCompare(b.type) || Number(a.number) - Number(b.number));
}

/** One bill per line, so a `git diff` of the weekly refresh shows which bills moved. */
export function formatRawBills(file: { bills: unknown[] } & Record<string, unknown>): string {
  const { bills, ...head } = file;
  return `{\n${Object.entries(head)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n")}\n"bills": [\n${bills.map((b) => JSON.stringify(b)).join(",\n")}\n]\n}\n`;
}
