import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { clemencyGrant, clemencyProclamation, clemencyYear, type ClemencyGrant } from "./clemency-entities";
import { buildClemencyPayload } from "./clemency-derive";
import type { ClemencyPayload } from "./clemency-types";

/** Clemency since Clinton, parsed at the boundary: `clemency_years.json` + `clemency_grants.json`. Drift fails the build. */
const OUT = join(process.cwd(), "pipeline", "output");
const file = z.object({ updated: z.string(), endOfBidenPending: z.number(), proclamations: z.array(clemencyProclamation), years: z.array(clemencyYear) });

export function getClemencyGrants(): ClemencyGrant[] {
  return z.array(clemencyGrant).parse(JSON.parse(readFileSync(join(OUT, "clemency_grants.json"), "utf8")));
}
export function getClemencyData(): ClemencyPayload {
  return buildClemencyPayload(file.parse(JSON.parse(readFileSync(join(OUT, "clemency_years.json"), "utf8"))), getClemencyGrants());
}
