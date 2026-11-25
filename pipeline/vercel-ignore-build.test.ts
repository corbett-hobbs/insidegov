import { describe, expect, it } from "vitest";
import { affectsSite, DEPLOY_MARKER, holdsForScheduledDeploy, isBotPreview, needsBuild } from "../scripts/vercel-ignore-build.mjs";

/**
 * Vercel bills build CPU per minute, so scripts/vercel-ignore-build.mjs skips builds that cannot change the site. The
 * cost of a wrong skip is a stale site, so this pins both sides: what the site reads must build, and the files the
 * bot and social work touch all day must not.
 */

describe("vercel ignored build step", () => {
  it("builds for everything the site renders or reads", () => {
    for (const f of [
      "app/page.tsx",
      "lib/congress-data.ts",
      "components/PageHeader.tsx",
      "public/images/hero.jpg",
      "pipeline/output/news_economy.json",
      "pipeline/output/faq_trade.json",
      "pipeline/raw/wikipedia-cases/manifest.json",
      "pipeline/reference/mayhew-major-laws.json",
      "next.config.ts",
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "vercel.json",
    ]) {
      expect(affectsSite(f), f).toBe(true);
    }
  });

  it("skips the files that only drive GitHub, the social posts and the pipeline code", () => {
    for (const f of [
      ".github/workflows/social-post.yml",
      "docs/TRADE_METHODOLOGY.md",
      "scripts/instagram-sync.sh",
      "pipeline/insights/slides.ts",
      "pipeline/insights/news/topics.ts",
      "pipeline/faq/publish.ts",
      "pipeline/fixtures/faq_trade.json",
      "pipeline/fetch/eia.ts",
      "pipeline/transform/trade.ts",
      "pipeline/README.md",
      "pipeline/workflows.test.ts",
      "lib/news-derive.test.ts",
      "README.md",
      "ARCHITECTURE_MAP.md",
      "eslint.config.mjs",
    ]) {
      expect(affectsSite(f), f).toBe(false);
    }
  });

  it("builds when any one changed file affects the site, or when nothing is listed", () => {
    expect(needsBuild([".github/workflows/ci.yml", "pipeline/insights/why.ts"])).toBe(false);
    expect(needsBuild([".github/workflows/ci.yml", "lib/site.ts"])).toBe(true);
    expect(needsBuild([])).toBe(true);
  });

  it("skips previews of the pipeline's data/* branches but never a production deploy or a human branch", () => {
    expect(isBotPreview("data/news-pages", "preview")).toBe(true);
    expect(isBotPreview("data/laws-refresh", "preview")).toBe(true);
    expect(isBotPreview("data/laws-refresh", "production")).toBe(false);
    expect(isBotPreview("main", "production")).toBe(false);
    expect(isBotPreview("claude/some-feature", "preview")).toBe(false);
    expect(isBotPreview(undefined, "preview")).toBe(false);
  });

  it("holds a production deploy of only pipeline data for the scheduled deploy, and builds everything else at once", () => {
    const data = ["pipeline/output/news_economy.json", "pipeline/output/laws.json", "pipeline/raw/wikipedia-cases/manifest.json"];
    expect(holdsForScheduledDeploy(data, "production", "chore(pipeline): refresh In the news cards (#1)")).toBe(true);
    // the scheduled deploy's own commit always builds, even though the diff since the last deploy is only data
    expect(holdsForScheduledDeploy(data, "production", `${DEPLOY_MARKER} publish pipeline data`)).toBe(false);
    // any code, content or config file in the diff builds, and carries the held data with it
    expect(holdsForScheduledDeploy([...data, "lib/site.ts"], "production", "fix")).toBe(false);
    expect(holdsForScheduledDeploy([...data, "public/og/economy.png"], "production", "refresh")).toBe(false);
    expect(holdsForScheduledDeploy([...data, "package.json"], "production", "bump")).toBe(false);
    // previews, an empty diff and a missing message are not held
    expect(holdsForScheduledDeploy(data, "preview", "refresh")).toBe(false);
    expect(holdsForScheduledDeploy([], "production", "refresh")).toBe(false);
    expect(holdsForScheduledDeploy(data, "production", undefined)).toBe(true);
  });
});
