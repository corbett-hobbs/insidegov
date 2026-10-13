import { z } from "zod";
import { LAWS_FIRST_CONGRESS, rawAction } from "./laws-entities";

/**
 * The fields the individual law pages need beyond the Laws track's raw files (`docs/LAW_PAGES_PLAN.md`, Phase 2a/2b): the full
 * CRS summary, the full action list, amendments, related bills and every cosponsor with dates (withdrawn ones flagged). Both fetchers
 * write the same shape to `pipeline/raw/law-extras/<congress>.json`: GovInfo Bill Status XML for the 108th Congress on (re-read from
 * the cached ZIPs, no network) and the Congress.gov API for the 93rd-107th. The existing `pipeline/raw/<source>/` files are untouched.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bioguide = z.string().regex(/^[A-Z]\d{6}$/);

/** One amendment to the bill. The two sources differ: Bill Status names the sponsor and submission date, the API a one-line description. */
export const rawAmendment = z.object({
  chamber: z.enum(["House", "Senate"]),
  /** HAMDT, SAMDT or SUAMDT. */
  type: z.string(),
  number: z.string().regex(/^\d+$/),
  /** Bioguide id when the sponsor is a member; a committee ("Rules Committee") has none. */
  sponsor: bioguide.nullable(),
  sponsor_name: z.string().nullable(),
  submitted: isoDate.nullable(),
  /** What the amendment does, as the source words it (capped). */
  purpose: z.string().nullable(),
  /** The amendment's last recorded step ("Amendment SA 6622 agreed to in Senate by Voice Vote."). */
  latest: z.object({ date: isoDate.nullable(), text: z.string() }).nullable(),
});
export type RawAmendment = z.infer<typeof rawAmendment>;

/** A bill the source relates to this one, with how ("Related bill", "Identical bill", "Procedurally-related", ...). */
export const rawRelatedBill = z.object({
  congress: z.number().int().min(1),
  /** HR, S, HJRES, SJRES, HRES, SRES, HCONRES, SCONRES. */
  type: z.string(),
  number: z.string().regex(/^\d+$/),
  title: z.string(),
  rel: z.array(z.string()),
});
export type RawRelatedBill = z.infer<typeof rawRelatedBill>;

/** The name is not kept: the page names a member from the member record by id. */
export const rawCosponsorRecord = z.object({
  id: bioguide,
  date: isoDate.nullable(),
  original: z.boolean(),
  withdrawn: isoDate.nullable(),
});
export type RawCosponsorRecord = z.infer<typeof rawCosponsorRecord>;

export const rawLawExtras = z.object({
  law_id: z.string().regex(/^\d+-pub-\d+$/),
  /** The CRS summary of the enacted version (else the latest), HTML as given, **not** capped. */
  summary_html: z.string().nullable(),
  /** Every action the source lists (introduction, committee, floor, presidential), de-duplicated and oldest first. */
  actions: z.array(rawAction),
  amendments: z.array(rawAmendment),
  related: z.array(rawRelatedBill),
  cosponsors: z.array(rawCosponsorRecord),
});
export type RawLawExtras = z.infer<typeof rawLawExtras>;

export const RAW_EXTRAS_DIR = "law-extras";

export const rawExtrasFile = z.object({
  source: z.enum(["govinfo-billstatus", "congress-gov"]),
  congress: z.number().int().min(LAWS_FIRST_CONGRESS),
  fetched: isoDate,
  laws: z.array(rawLawExtras).min(1),
});
export type RawExtrasFile = z.infer<typeof rawExtrasFile>;

export const AMENDMENT_PURPOSE_CAP = 240;
