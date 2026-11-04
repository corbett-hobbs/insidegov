import { readFileSync, writeFileSync } from "node:fs";

/** A seeded random sample of 100 classified offenses for a person to check: docs/clemency-offense-audit.csv. `pnpm classify:clemency:audit`. */
const rows = JSON.parse(readFileSync("pipeline/classification/clemency_offenses.json", "utf8")) as { offense: string; category: string; evidence: string }[];
let seed = 20261103;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pool = [...rows];
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j]!, pool[i]!];
}
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
writeFileSync("docs/clemency-offense-audit.csv", ["category,offense,evidence,correct(y/n)", ...pool.slice(0, 100).map((r) => `${r.category},${q(r.offense)},${q(r.evidence)},`)].join("\n") + "\n");
