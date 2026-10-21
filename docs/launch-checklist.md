# Launch checklist

What the code now does for discovery and measurement, and the manual steps only the owner can do. Do these in order; each is a few minutes.

## What is already built

- **Analytics.** Vercel Web Analytics (cookieless, no consent banner) is in `app/layout.tsx`. Custom events go through `track()` in `lib/analytics.ts`: `filter_change`, `chart_pin`, `chart_zoom`, `outbound_click`. Add an event by adding it to `AnalyticsEvents`.
- **API and MCP usage.** `/api/v1/datasets/<id>`, `/api/v1/datasets/<id>/rows` and `/mcp` write one JSON log line per call (`"evt":"insidegov_api"`: surface, dataset or tool, user agent; no IP or query values) via `lib/api-log.ts`. Find them in Vercel → Logs by searching `insidegov_api`. The two static endpoints (`/api/v1`, `/api/v1/datasets`) are prerendered, so they do not run per call and are not logged.
- **Sitemap.** `app/sitemap.ts` sets `lastModified` from the data, not the build: `lib/data-freshness.ts` reads the pipeline reports (Congress: bills `data_through`; Presidency: newest executive order, foreign-aid, energy and trade date; Court: the SCDB release) and laws use their signing date. A branch with no readable date omits `lastModified`.
- **Structured data (JSON-LD).** `Organization` and `WebSite` on every page; `Dataset` on each topic page (sources and cadence from `lib/methodology-content.ts`); `Person` on member, justice and president pages; `Legislation` on law pages. Builders are in `lib/structured-data.ts`, rendered by `components/JsonLd.tsx`. There is no `SearchAction`: search is an in-page modal with no results URL.

## Manual steps

1. **Set the canonical domain.** In Vercel → Project → Settings → Environment Variables, add `NEXT_PUBLIC_SITE_URL` = `https://your-domain` (no trailing slash) for Production, then redeploy. Canonicals, the sitemap, `robots.txt`, Open Graph and every JSON-LD URL read it (`lib/site.ts`). Until it is set they use the `*.vercel.app` production URL, which you do not want indexed long term. Also attach the domain under Settings → Domains and make it primary.
2. **Turn on Web Analytics.** Vercel → Project → Analytics → Enable. Nothing shows until this is on, even though the code is deployed. Custom events (the four above) need a plan that includes them; check Analytics → Events after a day of traffic.
3. **Google Search Console.** Add the domain as a *Domain* property (DNS TXT record) or a URL-prefix property, verify it, then Sitemaps → submit `https://your-domain/sitemap.xml`. Use URL Inspection on `/` and one topic page and request indexing.
4. **Bing Webmaster Tools.** Sign in, then *Import from Google Search Console* (one click once step 3 is verified), and submit the same sitemap. Bing also feeds DuckDuckGo and several AI search tools.
5. **Check the markup.** Paste a live topic URL, a member URL and a law URL into the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/). `Dataset` shows in Google Dataset Search, not as a rich result, so a "no rich results" note for it is expected.
6. **Check the production sitemap.** Open `/sitemap.xml` on production and confirm `<loc>` uses your domain and `<lastmod>` values are data dates, not today.

## Later

- Watch Search Console → Pages for "Discovered, not indexed": the ~11k law pages are mostly rendered on first request, so Google may take weeks to pick them up.
- Review `outbound_click` hosts monthly to see which sources readers follow.
