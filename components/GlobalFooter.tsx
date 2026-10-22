import Link from "next/link";
import { siteInfo, socialLinks } from "@/lib/site-info";

const LINK =
  "text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function FooterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="m-0 mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{title}</h2>
      <ul className="m-0 flex list-none flex-col p-0 [&_a]:inline-block [&_a]:py-1.5">{children}</ul>
    </div>
  );
}

/**
 * The site-wide footer, rendered once by the root layout: three labeled link columns,
 * a hairline, then the disclaimer.
 * Page-specific source lines (e.g. `senate/SiteFooter`) stay on their pages.
 * Only links to routes that exist belong here.
 */
export function GlobalFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
        <nav aria-label="About InsideGov and project" className="grid grid-cols-3 gap-x-4 pb-4 pt-5 text-[0.88rem]">
          <FooterGroup title="Project">
            <li><Link href="/about" className={LINK}>About</Link></li>
            <li><Link href="/contact" className={LINK}>Contact</Link></li>
          </FooterGroup>
          <FooterGroup title="Data and tools">
            <li><Link href="/methodology" className={LINK}>Methodology</Link></li>
            <li><Link href="/api" className={LINK}>API and MCP</Link></li>
          </FooterGroup>
          <FooterGroup title="Follow">
            <li><a href={siteInfo.githubUrl} className={LINK} rel="noopener">GitHub <span aria-hidden="true">↗</span></a></li>
            {socialLinks().map((l) => (
              <li key={l.label}>
                <a href={l.url} className={LINK} rel="noopener">{l.label} <span aria-hidden="true">↗</span></a>
              </li>
            ))}
          </FooterGroup>
        </nav>
        <div className="flex flex-col gap-1.5 border-t border-line pb-6 pt-4 text-[0.78rem] leading-[1.6] text-ink-muted">
          <p className="m-0">
            InsideGov is an independent project and is not affiliated with any government agency or political party.
          </p>
        </div>
      </div>
    </footer>
  );
}
