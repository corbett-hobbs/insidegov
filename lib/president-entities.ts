import { z } from "zod";

/**
 * `pipeline/output/president_bios.json`: one row per president with a page (Truman on), written by
 * `pipeline/fetch/president-bios.ts` from Wikipedia. Keyed by the `president_slug` every administrations table uses.
 */
export const presidentBio = z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  extract: z.string().min(1),
  url: z.string().regex(/^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/),
  revision: z.string().regex(/^\d+$/),
  fetched_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Official portrait, present only when the Commons license metadata says public domain / CC0. */
  photo: z
    .strictObject({
      /** Path under `public/`, e.g. `/images/presidents/barack-obama.jpg`. */
      path: z.string().regex(/^\/images\/presidents\/[a-z0-9-]+\.(jpg|png)$/),
      source_url: z.string().url(),
      license: z.string().min(1),
    })
    .nullable(),
});
export type PresidentBio = z.infer<typeof presidentBio>;
