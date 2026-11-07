/**
 * Post-to links for a chart's share menu (`components/charts/ChartShare.tsx`). Pure: each opens the
 * network's own compose box with the chart's title and its link (path + filters + `#chart`).
 */
export interface ShareLink {
  label: string;
  href: string;
}

export function shareLinks(url: string, text: string): ShareLink[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return [
    { label: "Post on X", href: `https://x.com/intent/post?text=${t}&url=${u}` },
    { label: "Post on Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}` },
  ];
}
