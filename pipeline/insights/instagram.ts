import type { DraftBlock } from "./issue";
import type { DatasetId } from "./types";

/**
 * The Instagram version of a draft's post text, for posting by hand: the checked caption, where to find the data (captions
 * there cannot hold a link, so it points to the link in bio), and a fixed set of topic hashtags.
 *
 * The hashtags are written here, per dataset, and never by the model: checkCaption still rejects a caption with "#", so
 * nothing like a slogan tag can get in. Keep each set 3 to 5 plain topic words (Instagram caps a post at 5), no party,
 * person or campaign tags, and the same last tag everywhere so the account's posts can be found together.
 */

export const INSTAGRAM_MAX = 2200;

export const INSTAGRAM_HASHTAGS: Record<DatasetId, string[]> = {
  energy: ["#energy", "#oil", "#electricity", "#govdata"],
  gas: ["#gasprices", "#diesel", "#energy", "#govdata"],
  trade: ["#trade", "#tariffs", "#imports", "#economy", "#govdata"],
  encounters: ["#border", "#immigration", "#CBP", "#govdata"],
  ice: ["#immigration", "#ICE", "#govdata"],
  executive_orders: ["#executiveorders", "#whitehouse", "#govdata"],
  laws: ["#congress", "#legislation", "#govdata"],
};

/** "insidegov.fyi/presidency/trade" from the draft's link, without the scheme, filter or card anchor. */
function pagePath(link: string): string {
  const u = new URL(link);
  return `${u.host}${u.pathname.replace(/\/$/, "")}`;
}

export function instagramCaption(block: Pick<DraftBlock, "caption" | "link" | "dataset">): string {
  const tags = INSTAGRAM_HASHTAGS[block.dataset as DatasetId] ?? [];
  return [block.caption, `Chart and full data at ${pagePath(block.link)} (link in bio).`, ...(tags.length ? [tags.join(" ")] : [])].join("\n\n");
}
