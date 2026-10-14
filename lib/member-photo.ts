/**
 * Where a member's committed photo lives, or the shared silhouette when the
 * source (@unitedstates/images) has none. Pure and client-safe; the images are
 * static assets under `public/`, fetched at build time by
 * `pipeline/fetch/photos.ts` — nothing here hits the network.
 *
 * `hasPhoto` comes from the build-time manifest (see lib/congress-data.ts); it
 * is set for current members and, from the manifest's `former` list, for
 * former members who have a small (90x110) photo; only that size exists for them.
 */
export const MEMBER_PHOTO_PLACEHOLDER = "/images/member-placeholder.svg";

/** "small" → 225×275 (tooltip); "large" → 450×550 (profile). */
export type MemberPhotoSize = "small" | "large";

export function memberPhotoSrc(
  bioguideId: string,
  hasPhoto: boolean,
  size: MemberPhotoSize,
): string {
  return hasPhoto
    ? `/images/members/${bioguideId}-${size}.jpg`
    : MEMBER_PHOTO_PLACEHOLDER;
}
