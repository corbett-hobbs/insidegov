#!/usr/bin/env node
/**
 * Vercel's Ignored Build Step (`ignoreCommand` in vercel.json). Exit 0 skips the build, exit 1 runs it.
 *
 * A build is skipped only when every file changed since the last build is one the site never reads: the workflows,
 * the docs, the social/FAQ/fetch/transform code under pipeline/, tests and tooling config. The site reads app/, lib/,
 * components/, public/, pipeline/output, pipeline/raw (a few manifests) and pipeline/reference, so a change to any of
 * those, to package.json or the lockfile, to next.config.ts, or to anything this list does not name still builds.
 *
 * It fails toward building: no previous SHA (the first deploy of a branch), a previous SHA the shallow clone does not
 * hold, an empty diff or a git error all run the build. CI (.github/workflows/ci.yml) typechecks, lints, tests and runs
 * `pnpm build` on every push, so a skipped Vercel build loses no check.
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SKIPPED = [
  /^\.github\//,
  /^docs\//,
  /^scripts\//,
  // Pipeline code and inputs: the site reads only pipeline/output, pipeline/raw and pipeline/reference.
  /^pipeline\/(insights|faq|fetch|transform|validate|wikipedia|financial_disclosures|preflight|fixtures|classification)\//,
  /^pipeline\/[^/]+\.(md|test\.ts)$/,
  /^[^/]+\.md$/,
  /^(eslint\.config\.mjs|vitest\.config\.ts|validate_palette\.js)$/,
  /\.test\.tsx?$/,
];

/** True when a change to this repo-relative path can change the built site. */
export const affectsSite = (file) => !SKIPPED.some((re) => re.test(file));

/** True when the build must run: any file affects the site, or none were listed. */
export const needsBuild = (files) => files.length === 0 || files.some(affectsSite);

function main() {
  const base = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const head = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";
  if (!base) {
    console.log("No previous deployment SHA: building.");
    return 1;
  }
  let files;
  try {
    // --no-renames lists both ends of a move, so app/x moved to docs/x still shows the app/ path.
    files = execFileSync("git", ["diff", "--name-only", "--no-renames", base, head], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.log(`Could not diff ${base}..${head} (not in the shallow clone?): building.`);
    return 1;
  }
  const relevant = files.filter(affectsSite);
  if (needsBuild(files)) {
    console.log(files.length === 0 ? "Empty diff: building." : `Site files changed (${relevant.length} of ${files.length}), e.g. ${relevant[0]}: building.`);
    return 1;
  }
  console.log(`Only non-site files changed (${files.length}): skipping the build.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
