#!/usr/bin/env node
/**
 * Vercel's Ignored Build Step (`ignoreCommand` in vercel.json). Exit 0 skips the build, exit 1 runs it.
 *
 * A build is skipped only when every file changed since the last build is one the site never reads: the workflows,
 * the docs, the social/FAQ/fetch/transform code under pipeline/, tests and tooling config. The site reads app/, lib/,
 * components/, public/, pipeline/output, pipeline/raw (a few manifests) and pipeline/reference, so a change to any of
 * those, to package.json or the lockfile, to next.config.ts, or to anything this list does not name still builds.
 *
 * A data-refresh PR (branch `data/*`, opened by the pipeline workflows) gets no Vercel preview at all: CI builds it before
 * the gate merges it, nobody opens that preview, and each one costs build CPU plus function and deployment storage for as
 * long as it is retained. The merge to main is a production deploy and still builds.
 *
 * Production data refreshes are batched. The pipeline merges a refresh to main several times a day, and every production
 * deploy bills build CPU and stores a full copy of the site, so a production deploy whose changes since the last deploy
 * are all pipeline data (`pipeline/output`, `pipeline/raw`) is skipped. They go out together in the scheduled deploy
 * (.github/workflows/scheduled-deploy.yml), which pushes an empty commit whose message starts with DEPLOY_MARKER and
 * always builds. Any code, content or config change in the diff builds at once and carries the held data with it, since
 * the diff runs from the last deployment.
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

/** The scheduled-deploy workflow's commit subject: a production commit that starts with it always builds. */
export const DEPLOY_MARKER = "chore(deploy):";

/** Pipeline data the site reads at build time: a change to only these can wait for the scheduled deploy. */
const DEFERRED = /^pipeline\/(output|raw)\//;

/** True when the build can wait for the next scheduled deploy: production, a marker-less commit, only data files changed. */
export const holdsForScheduledDeploy = (files, env, message) =>
  env === "production" && !(message ?? "").startsWith(DEPLOY_MARKER) && files.length > 0 && files.every((f) => DEFERRED.test(f));

/** True for a preview deployment of a branch the pipeline workflows open (`data/<name>-refresh`, `data/news-pages`). */
export const isBotPreview = (ref, env) => env !== "production" && /^data\//.test(ref ?? "");

/** True when a change to this repo-relative path can change the built site. */
export const affectsSite = (file) => !SKIPPED.some((re) => re.test(file));

/** True when the build must run: any file affects the site, or none were listed. */
export const needsBuild = (files) => files.length === 0 || files.some(affectsSite);

function main() {
  if (isBotPreview(process.env.VERCEL_GIT_COMMIT_REF, process.env.VERCEL_ENV)) {
    console.log(`Preview of pipeline branch ${process.env.VERCEL_GIT_COMMIT_REF}: CI builds it, skipping the Vercel build.`);
    return 0;
  }
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
  if (holdsForScheduledDeploy(files, process.env.VERCEL_ENV, process.env.VERCEL_GIT_COMMIT_MESSAGE)) {
    console.log(`Only pipeline data changed (${files.length}): holding it for the scheduled deploy.`);
    return 0;
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
