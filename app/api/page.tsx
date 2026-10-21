import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { GROUP_LABEL, listDatasetDefs, type DatasetGroup } from "@/lib/api-datasets";
import { siteUrl } from "@/lib/site";
import { docUrl } from "@/lib/site-info";

const DESCRIPTION =
  "Query the data behind InsideGov's charts: a free JSON and CSV API and an MCP server for AI assistants. Free to use with credit to InsideGov.";

export const metadata: Metadata = pageMetadata({
  title: "Free Government Data API and MCP Server",
  description: DESCRIPTION,
  path: "/api",
});

const LINK =
  "text-accent underline underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const API = `${siteUrl}/api/v1`;
const MCP = `${siteUrl}/mcp`;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="m-0 font-serif text-[1.35rem] font-medium leading-tight">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="min-w-0">
      {label && <div className="mb-1 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-ink-faint">{label}</div>}
      <pre className="m-0 overflow-x-auto rounded border border-line bg-surface-raised p-3 font-mono text-[0.78rem] leading-[1.55] text-ink">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
);

const PARAMS: [string, string][] = [
  ["country_key=MEX", "Only rows where that field equals the value. Add more with &, e.g. country_key=MEX&fiscal_year=2023."],
  ["fiscal_year=2010..2020", "A range, both ends included. Works on numbers and on dates."],
  ["fiscal_year=2010..", "Leave one end off: 2010 or later. (..2020 means 2020 or earlier.)"],
  ["sort=-fiscal_year", "Order the rows by a field. A leading - puts the biggest or newest first."],
  ["fields=recipient_name,fiscal_year", "Return only these columns."],
  ["limit=100&offset=100", "How many rows to return (up to 5,000) and how many to skip, to get the next page."],
  ["format=csv", "A spreadsheet-ready CSV instead of JSON."],
];

const TOOLS: [string, string][] = [
  ["list_datasets", "Lists the datasets, optionally for one branch or matching a word."],
  ["describe_dataset", "What a row is, units, source, every field with its type and meaning, row count, sample rows."],
  ["query_dataset", "Filter, sort and page one dataset. Same filters as the API."],
];

const GROUPS: DatasetGroup[] = ["presidency", "congress", "court"];

export default function ApiPage() {
  const defs = listDatasetDefs();
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <PageHeader eyebrow="For developers and researchers" title="API and MCP">
        <p>
          The tables behind InsideGov’s charts, free to query. Pull them as JSON or CSV, or connect an AI assistant
          straight to them over MCP. {defs.length} datasets across the presidency, Congress and the Supreme Court. No
          account and no key.
        </p>
      </PageHeader>

      <div className="flex flex-col gap-10 text-[0.95rem] leading-[1.65] [&_p]:m-0">
        <Section id="terms" title="Use it freely. Credit InsideGov.">
          <p>
            You may use this data in apps, articles, research, classrooms and AI products, as long as you credit InsideGov.
            Name it “InsideGov” and, where you can, link that name to the homepage. For example: Data:{" "}
            <a href={siteUrl} className={LINK}>InsideGov</a>
          </p>
          <Code label="Where you can use HTML">{`Data: <a href="${siteUrl}">InsideGov</a>`}</Code>
          <Code label="Plain text">{`Data: InsideGov`}</Code>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
            <li>
              Every response carries the credit line in an <Mono>attribution</Mono> field (CSV: an <Mono>X-Attribution</Mono> header).
              Keep it with the numbers when you pass them on.
            </li>
            <li>
              The numbers come from public sources, named in each response’s <Mono>sources</Mono> and in the catalog below.
              Name them too when you can; the <Link href="/methodology" className={LINK}>methodology page</Link> has the citations.
            </li>
            <li>
              A few datasets carry the source’s own terms in a <Mono>license</Mono> field. The Supreme Court decisions tables are
              non-commercial (CC BY-NC 3.0 US), and the troops history and bases tables are built on GPL-3.0 data. Those terms
              apply to what you build from them.
            </li>
            <li>
              These are descriptions of what the records show, not findings of cause, and InsideGov gives no warranty. Check
              the units and the caveats in <Mono>describe</Mono> before you rely on a number. Spotted an error?{" "}
              <Link href="/contact?topic=correction&page=%2Fapi" className={LINK}>Report a correction</Link>.
            </li>
          </ul>
        </Section>

        <Section id="quick-start" title="Quick start">
          <p>
            The base URL is <Mono>{API}</Mono>. Everything is a GET and needs no key. Start with the list, then ask
            about one dataset to see its fields.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <Code label="List the datasets">{`curl ${API}/datasets`}</Code>
            <Code label="Describe one: units, fields, sample rows">{`curl ${API}/datasets/foreign-assistance`}</Code>
            <Code label="Aid to Ukraine since 2022 by sector, biggest first">{`curl "${API}/datasets/foreign-assistance/rows\\
?country_key=UKR&fiscal_year=2022..\\
&sort=-disbursements_usd&limit=5"`}</Code>
            <Code label="Executive orders in 2025 as CSV">{`curl "${API}/datasets/executive-orders/rows\\
?signing_date=2025-01-01..\\
&fields=eo_number,signing_date,title,topic&format=csv"`}</Code>
          </div>
          <Code label="Response shape">{`{
  "dataset": "foreign-assistance",
  "attribution": "Data from InsideGov (${siteUrl}). Please credit InsideGov when you use it.",
  "sources": ["ForeignAssistance.gov, U.S. Department of State"],
  "license": null,
  "total": 44,         // rows that match, before paging
  "limit": 5,
  "offset": 0,
  "returned": 5,
  "next": "${API}/datasets/foreign-assistance/rows?...&offset=5",
  "data": [ { "recipient_name": "Ukraine", "fiscal_year": 2023, "sector_category": "Economic Development", ... } ]
}`}</Code>
        </Section>

        <Section id="query" title="Query reference">
          <p>
            Any field in a dataset can be a filter, and filters combine: every one must be true. Open a dataset to see its
            field names; a misspelled field returns an error that lists the valid ones. Put the options after a{" "}
            <Mono>?</Mono> in the URL and join them with <Mono>&</Mono>.
          </p>
          <div className="overflow-hidden rounded border border-line">
            <dl className="m-0 divide-y divide-line">
              {PARAMS.map(([k, v]) => (
                <div key={k} className="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[19rem_1fr]">
                  <dt className="font-mono text-[0.8rem] text-ink">{k}</dt>
                  <dd className="m-0 text-[0.88rem] text-ink-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="text-[0.88rem] text-ink-muted">
            Answers are cached for an hour and a response is capped near 4 MB, so page large pulls with{" "}
            <Mono>limit</Mono> and <Mono>offset</Mono>. The data changes only when the site’s sources refresh. There is no
            rate limit today; please cache what you fetch and keep requests reasonable. An OpenAPI description is at{" "}
            <a href="/api/v1/openapi.json" className={LINK}>/api/v1/openapi.json</a>. The <Mono>v1</Mono> shapes only gain
            fields; they are not renamed or removed.
          </p>
        </Section>

        <Section id="mcp" title="MCP server">
          <p>
            Connect an AI assistant to the same tables and it can look up, filter and compare them while it answers.
            The server is at <Mono>{MCP}</Mono> (Streamable HTTP, no sign-in).
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            <Code label="Claude Code">{`claude mcp add --transport http insidegov ${MCP}`}</Code>
            <Code label="Claude (web and desktop)">{`Settings → Connectors → Add custom connector
Name: InsideGov
URL:  ${MCP}`}</Code>
            <Code label="Cursor, VS Code and other clients with a config file">{`{
  "mcpServers": {
    "insidegov": { "url": "${MCP}" }
  }
}`}</Code>
            <Code label="Clients that only speak stdio">{`npx mcp-remote ${MCP}`}</Code>
          </div>
          <div className="overflow-hidden rounded border border-line">
            <dl className="m-0 divide-y divide-line">
              {TOOLS.map(([k, v]) => (
                <div key={k} className="grid gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[12rem_1fr]">
                  <dt className="font-mono text-[0.8rem] text-ink">{k}</dt>
                  <dd className="m-0 text-[0.88rem] text-ink-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p>Then ask in plain language. For example:</p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
            <li>How many executive orders did each president sign in their first year?</li>
            <li>Which countries received the most U.S. foreign assistance in 2023, and how much of it was military?</li>
            <li>How has the share of Supreme Court cases decided 5–4 changed since 1990? (Non-commercial use.)</li>
            <li>What was the effective U.S. duty rate in each year since 2017?</li>
          </ul>
          <p className="text-[0.88rem] text-ink-muted">
            Each tool result carries the credit line, and the server tells the assistant to cite InsideGov and the underlying
            source. Results are kept short for a model to read: up to 200 rows a call, with <Mono>next_offset</Mono> to continue.
          </p>
        </Section>

        <Section id="datasets" title={`The ${defs.length} datasets`}>
          <p>
            Each is a table from the site’s pipeline, with its own units and keys, before any page-specific joining. Join them
            on shared keys: <Mono>bioguide_id</Mono> for people in Congress, <Mono>justice_id</Mono> for justices,{" "}
            <Mono>term_id</Mono> for presidential terms, <Mono>country_code</Mono> or <Mono>country_key</Mono> for places.
            Open a dataset to see every field.
          </p>
          {GROUPS.map((g) => (
            <div key={g} className="flex flex-col gap-2">
              <h3 className="m-0 font-mono text-[0.72rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
                {GROUP_LABEL[g]}
              </h3>
              <ul className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded border border-line p-0">
                {defs
                  .filter((d) => d.group === g)
                  .map((d) => (
                    <li key={d.id} className="flex flex-col gap-1 px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <a href={`/api/v1/datasets/${d.id}`} className={`${LINK} font-mono text-[0.85rem]`}>
                          {d.id}
                        </a>
                        <span className="font-medium">{d.title}</span>
                      </div>
                      <p className="text-[0.88rem] text-ink-muted">{d.description}</p>
                      <p className="text-[0.8rem] text-ink-muted">
                        One row: {d.grain}.{d.units ? ` ${d.units}` : ""} Source: {d.sources.join("; ")}. Feeds{" "}
                        <Link href={d.page.href} className={LINK}>{d.page.label}</Link>
                        {d.doc && (
                          <>
                            {" · "}
                            <a href={docUrl(d.doc)} className={LINK}>methodology</a>
                          </>
                        )}
                        .
                      </p>
                      {d.license && <p className="text-[0.8rem] text-ink">Terms: {d.license}</p>}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <p className="text-[0.88rem] text-ink-muted">
            Left out for now: Wikipedia-derived text (bios, case summaries, landmark lists), photos, each law’s action history
            and the per-filing financial line items. They stay on the pages they appear on.
          </p>
        </Section>
      </div>
    </main>
  );
}
