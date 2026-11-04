import { CLEMENCY_TERMS, OFFENSE_CATEGORIES, OFFENSE_LABELS, type ClemencyGrant, type ClemencyProclamation, type ClemencyTermId, type ClemencyYear, type OffenseCategory } from "./clemency-entities";

export { CLEMENCY_TERMS, OFFENSE_CATEGORIES, OFFENSE_LABELS };
export type { ClemencyGrant, ClemencyProclamation, ClemencyTermId, ClemencyYear, OffenseCategory };

export const TIMING_BUCKETS = ["first", "middle", "finalYear", "last90"] as const;
export type TimingBucket = (typeof TIMING_BUCKETS)[number];

export interface ClemencyPresident {
  term: ClemencyTermId;
  label: string;
  president: string;
  party: "D" | "R";
  firstFy: number;
  lastFy: number;
  months: number;
  pardons: number;
  commutations: number;
  group: number;
  total: number;
  /** Null for the current term: DOJ hasn't published these. */
  outcome: { granted: number; denied: number; closed: number; share: number } | null;
  offense: { n: number; counts: Record<OffenseCategory, number> };
  timing: { n: number; counts: Record<TimingBucket, number> };
  age: { n: number; of: number; q1: number; median: number; q3: number; within5: number } | null;
}

export interface ClemencyPayload {
  updated: string;
  firstFy: number;
  lastFy: number;
  years: ClemencyYear[];
  presidents: ClemencyPresident[];
  proclamations: ClemencyProclamation[];
  pending: { fy: number; value: number }[];
  endOfBidenPending: number;
  listed: number;
}
export type ClemencyFile = { updated: string; endOfBidenPending: number; proclamations: ClemencyProclamation[]; years: ClemencyYear[] };
