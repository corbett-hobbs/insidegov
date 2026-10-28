import type { DraftBlock } from "./issue";
import type { DatasetId } from "./types";

/**
 * The Instagram version of a draft's post text, for posting by hand: the checked caption, where to find the data (captions
 * there cannot hold a link, so it points to the link in bio), and a fixed set of topic hashtags.
 *
 * The hashtags are written here, per series (falling back to the dataset's), and never by the model: checkCaption still rejects a caption with "#", so
 * nothing like a slogan tag can get in. Keep each set 3 to 5 plain topic words (Instagram caps a post at 5), no party,
 * person or campaign tags, and the same last tag everywhere so the account's posts can be found together.
 */

export const INSTAGRAM_MAX = 2200;

export const INSTAGRAM_HASHTAGS: Record<DatasetId, string[]> = {
  energy: ["#energy", "#oil", "#naturalgas", "#govdata"],
  gas: ["#gasprices", "#diesel", "#energy", "#govdata"],
  trade: ["#trade", "#tariffs", "#imports", "#economy", "#govdata"],
  encounters: ["#border", "#immigration", "#CBP", "#govdata"],
  ice: ["#immigration", "#ICE", "#govdata"],
  executive_orders: ["#executiveorders", "#whitehouse", "#govdata"],
  laws: ["#congress", "#legislation", "#govdata"],
};

/** Tags for a series whose dataset's set would be off topic (an electricity chart under #oil). */
export const SERIES_HASHTAGS: Record<string, string[]> = {
  "energy.power_total": ["#electricity", "#naturalgas", "#solarenergy", "#energy", "#govdata"],
  "energy.power_gas": ["#electricity", "#naturalgas", "#energy", "#govdata"],
  "energy.power_coal": ["#electricity", "#coal", "#energy", "#govdata"],
  "energy.power_nuclear": ["#electricity", "#nuclearenergy", "#energy", "#govdata"],
  "energy.power_wind": ["#electricity", "#windenergy", "#energy", "#govdata"],
  "energy.power_solar": ["#electricity", "#solarenergy", "#energy", "#govdata"],
  "energy.gas_production": ["#naturalgas", "#energy", "#govdata"],
  "energy.lng_exports": ["#naturalgas", "#LNG", "#energy", "#govdata"],
  "energy.spr": ["#oil", "#energy", "#govdata"],
  "economy.mortgage_rate": ["#mortgagerates", "#housing", "#economy", "#govdata"],
  "economy.unemployment": ["#unemployment", "#jobs", "#economy", "#govdata"],
  "economy.inflation": ["#inflation", "#cpi", "#economy", "#govdata"],
  "economy.jobs_added": ["#jobsreport", "#jobs", "#economy", "#govdata"],
  "economy.real_earnings": ["#wages", "#inflation", "#economy", "#govdata"],
  "economy.gdp_growth": ["#gdp", "#economy", "#govdata"],
  "economy.household_income": ["#income", "#economy", "#govdata"],
  "economy.deficit": ["#deficit", "#federalbudget", "#economy", "#govdata"],
  "economy.debt": ["#nationaldebt", "#federalbudget", "#economy", "#govdata"],
  "energy.crude_production": ["#oil", "#energy", "#govdata"],
  "energy.crude_exports": ["#oil", "#exports", "#energy", "#govdata"],
  "energy.petroleum_exports": ["#oil", "#exports", "#energy", "#govdata"],
  "energy.petroleum_imports": ["#oil", "#imports", "#energy", "#govdata"],
};

export function hashtagsFor(block: Pick<DraftBlock, "dataset" | "series_id">): string[] {
  return SERIES_HASHTAGS[block.series_id] ?? INSTAGRAM_HASHTAGS[block.dataset as DatasetId] ?? [];
}

/** "insidegov.fyi/presidency/trade" from the draft's link, without the scheme, filter or card anchor. */
function pagePath(link: string): string {
  const u = new URL(link);
  return `${u.host}${u.pathname.replace(/\/$/, "")}`;
}

export function instagramCaption(block: Pick<DraftBlock, "caption" | "link" | "dataset" | "series_id">): string {
  const tags = hashtagsFor(block);
  return [block.caption, `Chart and full data at ${pagePath(block.link)} (link in bio).`, ...(tags.length ? [tags.join(" ")] : [])].join("\n\n");
}
