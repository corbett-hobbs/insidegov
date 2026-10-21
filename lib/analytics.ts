import { track as vercelTrack } from "@vercel/analytics";

/**
 * Custom Web Analytics events. Cookieless and anonymous: events carry a name and a few short
 * properties, never user input. Vercel adds the page path to every event itself.
 *
 * Add an event by adding it to `AnalyticsEvents`; `track` is then type-checked at every call site.
 */
export interface AnalyticsEvents {
  /** A chart or list filter changed (pill group, dropdown, multi-select, sort, range). */
  filter_change: { control: string; value?: string };
  /** A chart reading was pinned by tap or click. */
  chart_pin: { chart?: string };
  /** A chart was zoomed or panned. `how` is the control or gesture used. */
  chart_zoom: { how: "in" | "out" | "reset" | "gesture" };
  /** A link left the site (source citations, Wikipedia, Congress.gov, ...). */
  outbound_click: { host: string; href: string };
}

type Props = Record<string, string | number | boolean | null>;

/** Last send per dedupe key, so a drag or a wheel spin counts once. */
const lastSent = new Map<string, number>();

/**
 * Send a custom event. Safe to call anywhere on the client (no-ops on the server and when analytics
 * is blocked). `throttleMs` collapses a burst of the same event (a slider drag, a wheel spin) to one.
 */
export function track<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E], throttleMs = 0): void {
  if (typeof window === "undefined") return;
  if (throttleMs > 0) {
    const now = Date.now();
    const key = event;
    if (now - (lastSent.get(key) ?? 0) < throttleMs) return;
    lastSent.set(key, now);
  }
  try {
    const clean: Props = {};
    for (const [k, v] of Object.entries(props)) if (v !== undefined) clean[k] = v as Props[string];
    vercelTrack(event, clean);
  } catch {
    // Analytics must never break the page.
  }
}
