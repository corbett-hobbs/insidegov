import { BILL_TYPES, type BillType, type RawAction, type RawLaw } from "../../lib/laws-entities";
import { AMENDMENT_PURPOSE_CAP, type RawAmendment, type RawCosponsorRecord, type RawLawExtras, type RawRelatedBill } from "../../lib/law-extras-entities";
import { becameLawDates, isoDay, keepAction, normaliseCommittees, lawId, parsePublicLawNumber, pickSummary, slimActions, type SummaryVersion } from "./laws-raw";

/**
 * Congress.gov API v3 (api.congress.gov), used for the Congresses GovInfo Bill Status does not cover (93rd-107th) and
 * as the overlap check for one bulk Congress. The key goes in an `X-Api-Key` header and is never put in a URL or a log line.
 * Measured in docs/LAWS_PREFLIGHT.md: 20,000 calls an hour, about 3 calls per law, and the law *list* repeats rows and
 * omits laws, so the law numbers are walked 1..N and the missing ones are looked up by number.
 */
export const API_BASE = "https://api.congress.gov/v3";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  key: string;
  /** Average requests a second across all workers. The hourly limit (20,000) allows 5.5. */
  perSecond?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** A minimal paced client: one shared schedule so concurrent workers cannot exceed the rate, 429 and 5xx retried with back-off. */
export class CongressApi {
  private readonly gap: number;
  private next = 0;
  calls = 0;
  remaining: number | null = null;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ApiClientOptions) {
    this.gap = 1000 / (opts.perSecond ?? 5);
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async slot(): Promise<void> {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.gap;
    if (at > now) await this.sleep(at - now);
  }

  /** GET a path (`/bill/118/hr/815/actions`); returns null on 404. */
  async get(path: string, params: Record<string, string | number> = {}): Promise<unknown | null> {
    const q = new URLSearchParams({ format: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    for (let attempt = 1; ; attempt++) {
      await this.slot();
      this.calls++;
      let res: Response;
      try {
        res = await this.fetchImpl(`${API_BASE}${path}?${q.toString()}`, { headers: { "x-api-key": this.opts.key, accept: "application/json" }, signal: AbortSignal.timeout(60_000) });
      } catch (e) {
        if (attempt >= 6) throw new ApiError(`GET ${path}: ${e instanceof Error ? e.message : "network error"}`, 0);
        await this.sleep(2000 * attempt);
        continue;
      }
      const rem = res.headers.get("x-ratelimit-remaining");
      if (rem !== null) this.remaining = Number(rem);
      if (res.status === 404) return null;
      if (res.ok) {
        // A connection dropped mid-body ("terminated") is retried like one dropped before the response.
        try {
          return await res.json();
        } catch (e) {
          if (attempt >= 6) throw new ApiError(`GET ${path}: ${e instanceof Error ? e.message : "body read failed"}`, 0);
          await this.sleep(2000 * attempt);
          continue;
        }
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 8) {
        const retry = Number(res.headers.get("retry-after"));
        await this.sleep(res.status === 429 ? (Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60_000) : 2000 * attempt);
        continue;
      }
      throw new ApiError(`GET ${path} -> ${res.status} ${res.statusText}`, res.status);
    }
  }

  /** Walk a paginated list (`limit` 250) and return the concatenated `field` arrays plus the source's own count. */
  async list(path: string, field: string): Promise<{ items: unknown[]; count: number }> {
    const items: unknown[] = [];
    let count = 0;
    for (let offset = 0; ; offset += 250) {
      const j = (await this.get(path, { limit: 250, offset })) as { pagination?: { count?: number; next?: string }; [k: string]: unknown } | null;
      if (!j) break;
      count = j.pagination?.count ?? count;
      const page = j[field];
      if (Array.isArray(page)) items.push(...page);
      if (!j.pagination?.next || !Array.isArray(page) || page.length === 0) break;
    }
    return { items, count };
  }
}

// ---- mapping API JSON -> RawLaw ----

interface ApiVote {
  chamber?: string;
  rollNumber?: number;
  sessionNumber?: number;
  date?: string;
}
interface ApiAction {
  actionDate?: string;
  text?: string;
  type?: string;
  sourceSystem?: { code?: number };
  recordedVotes?: ApiVote[];
}
export interface ApiBillDetail {
  number?: string;
  type?: string;
  originChamber?: string;
  title?: string;
  introducedDate?: string;
  updateDate?: string;
  sponsors?: { bioguideId?: string; fullName?: string }[];
  policyArea?: { name?: string } | null;
  laws?: { number?: string; type?: string }[];
  latestAction?: { actionDate?: string };
}
export interface ApiSummary {
  actionDate?: string;
  actionDesc?: string;
  text?: string;
}
export interface ApiCosponsor {
  bioguideId?: string;
  sponsorshipWithdrawnDate?: string | null;
}

export interface ApiCommittee {
  systemCode?: string;
  name?: string;
  chamber?: string;
  activities?: { name?: string; date?: string }[];
  subcommittees?: { systemCode?: string; name?: string; activities?: { name?: string; date?: string }[] }[];
}

/** `/bill/.../committees` items -> the stored shape. */
export const apiCommittees = (list: ApiCommittee[]) =>
  normaliseCommittees(list.map((c) => ({ code: c.systemCode, name: c.name, chamber: c.chamber, activities: c.activities, subcommittees: (c.subcommittees ?? []).map((s) => ({ code: s.systemCode, name: s.name, activities: s.activities })) })));

export const apiActions = (raw: ApiAction[], all = false): RawAction[] =>
  raw.flatMap((a) => {
    const date = isoDay(a.actionDate);
    const type = a.type ?? "";
    const text = a.text ?? "";
    if (!date) return [];
    const votes: NonNullable<RawAction["votes"]> = (a.recordedVotes ?? []).flatMap((v) => {
      const ch = v.chamber === "House" || v.chamber === "Senate" ? v.chamber : null;
      return ch && Number.isInteger(v.rollNumber)
        ? [{ chamber: ch, roll: v.rollNumber as number, session: Number.isInteger(v.sessionNumber) ? (v.sessionNumber as number) : null, date: isoDay(v.date) }]
        : [];
    });
    if (all ? text === "" : !keepAction(type, text, votes.length > 0)) return [];
    return [{ date, type, text, src: Number.isInteger(a.sourceSystem?.code) ? (a.sourceSystem!.code as number) : null, ...(votes.length > 0 ? { votes } : {}) }];
  });

/** Build the records for one bill: one `RawLaw` per public-law number it carries in `congress`. */
export function lawsFromApiBill(congress: number, bill: ApiBillDetail, actions: ApiAction[], summaries: ApiSummary[], cosponsors: ApiCosponsor[], committees: ApiCommittee[]): RawLaw[] {
  const type = (bill.type ?? "").toLowerCase();
  if (!(BILL_TYPES as readonly string[]).includes(type)) throw new Error(`bill type "${bill.type}" cannot become a public law`);
  const numbers = (bill.laws ?? [])
    .filter((l) => l.type === "Public Law")
    .map((l) => parsePublicLawNumber(l.number ?? ""))
    .filter((x): x is [number, number] => x !== null && x[0] === congress);
  const slim = slimActions(apiActions(actions));
  const versions: SummaryVersion[] = summaries.map((s) => ({ stage: s.actionDesc ?? null, date: isoDay(s.actionDate), html: s.text ?? "" }));
  const summary = pickSummary(versions);
  const sponsor = bill.sponsors?.[0];
  const origin = bill.originChamber === "House" || bill.originChamber === "Senate" ? bill.originChamber : null;
  return numbers.map(([c, n]) => ({
    law_id: lawId(c, n),
    congress: c,
    number: n,
    bill_type: type as BillType,
    bill_number: bill.number ?? "",
    origin_chamber: origin,
    title: bill.title ?? "",
    introduced: isoDay(bill.introducedDate),
    sponsor: sponsor?.bioguideId ?? null,
    sponsor_name: sponsor?.fullName ?? null,
    cosponsors: cosponsors.filter((c2) => !c2.sponsorshipWithdrawnDate && c2.bioguideId).map((c2) => c2.bioguideId as string),
    policy_area: bill.policyArea?.name ?? null,
    summary_html: summary?.html ?? null,
    summary_stage: summary?.stage ?? null,
    became_law: becameLawDates(slim),
    latest_action_date: isoDay(bill.latestAction?.actionDate),
    updated: isoDay(bill.updateDate),
    actions: slim,
    committees: apiCommittees(committees),
  }));
}

/** A row of `/law/{congress}/pub`: just the fields the fetch plan needs. */
export interface LawListRow {
  type: string;
  number: string;
  updateDate?: string;
  laws: { number: string; type: string }[];
}

// ---- the law pages' extra fields from the API (93rd-107th Congress) ----

export interface ApiAmendment {
  number?: string;
  type?: string;
  description?: string;
  purpose?: string;
  latestAction?: { actionDate?: string; text?: string } | null;
  sponsors?: { bioguideId?: string; fullName?: string }[];
}
export interface ApiRelatedBill {
  congress?: number;
  type?: string;
  number?: number | string;
  title?: string;
  relationshipDetails?: { type?: string }[];
}
export interface ApiCosponsorFull extends ApiCosponsor {
  sponsorshipDate?: string;
  isOriginalCosponsor?: boolean;
}

const oneLine = (s: string, cap: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > cap ? t.slice(0, cap - 1) + "…" : t;
};

export function apiAmendments(list: ApiAmendment[]): RawAmendment[] {
  return list.flatMap((a) => {
    const type = (a.type ?? "").toUpperCase();
    const chamber = type.startsWith("H") ? "House" : type.startsWith("S") ? "Senate" : null;
    if (!chamber || !a.number || !/^\d+$/.test(a.number)) return [];
    const purpose = a.purpose ?? a.description ?? null;
    const sp = a.sponsors?.[0];
    return [
      {
        chamber,
        type,
        number: a.number,
        sponsor: sp?.bioguideId && /^[A-Z]\d{6}$/.test(sp.bioguideId) ? sp.bioguideId : null,
        sponsor_name: sp?.fullName ? oneLine(sp.fullName, 120) : null,
        submitted: null,
        purpose: purpose && purpose.trim() !== "" ? oneLine(purpose, AMENDMENT_PURPOSE_CAP) : null,
        latest: a.latestAction?.text ? { date: isoDay(a.latestAction.actionDate), text: oneLine(a.latestAction.text, 200) } : null,
      },
    ];
  });
}

export function apiRelatedBills(list: ApiRelatedBill[]): RawRelatedBill[] {
  return list
    .flatMap((r) => {
      const number = String(r.number ?? "");
      if (!r.type || !Number.isInteger(r.congress) || !/^\d+$/.test(number)) return [];
      return [{ congress: r.congress as number, type: r.type.toUpperCase(), number, title: oneLine(r.title ?? "", 220), rel: [...new Set((r.relationshipDetails ?? []).flatMap((d) => d.type ?? []))].sort() }];
    })
    .sort((a, b) => a.congress - b.congress || a.type.localeCompare(b.type) || Number(a.number) - Number(b.number));
}

export function apiCosponsorRecords(list: ApiCosponsorFull[]): RawCosponsorRecord[] {
  return list.flatMap((c) => (c.bioguideId && /^[A-Z]\d{6}$/.test(c.bioguideId) ? [{ id: c.bioguideId, date: isoDay(c.sponsorshipDate), original: c.isOriginalCosponsor === true, withdrawn: isoDay(c.sponsorshipWithdrawnDate) }] : []));
}

/**
 * The extras for one bill (shared by every law the bill became). For the 93rd-107th only the full summary and every cosponsor with dates
 * are kept: the full action list, amendments and related bills (about 60% of the size) are little used for laws that old, which keep the
 * Phase 1 action list built from the Laws raw files.
 */
export function extrasFromApiBill(lawIds: string[], parts: { summaries: ApiSummary[]; cosponsors: ApiCosponsorFull[] }): RawLawExtras[] {
  const versions: SummaryVersion[] = parts.summaries.map((s) => ({ stage: s.actionDesc ?? null, date: isoDay(s.actionDate), html: s.text ?? "" }));
  const body = { summary_html: pickSummary(versions, Infinity)?.html ?? null, cosponsors: apiCosponsorRecords(parts.cosponsors) };
  return lawIds.map((law_id) => ({ law_id, ...body }));
}
