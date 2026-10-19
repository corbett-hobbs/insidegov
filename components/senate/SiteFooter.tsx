import { SourceLink } from "@/components/SourceLink";

interface SiteFooterProps {
  children?: React.ReactNode;
}

/**
 * Source footer of the Congress ideology explorer (the home page no longer has one). Carries the Voteview citation required by docs/CREDITS.md now
 * that the data is surfaced in a page.
 */
export function SiteFooter({ children }: SiteFooterProps) {
  return (
    <footer className="flex flex-col items-start gap-[0.85rem]">
      {children}
      <p className="m-0 text-[0.8rem] leading-[1.6] text-ink-muted">
        Ideology data: Lewis, Jeffrey B., Keith Poole, Howard Rosenthal, Adam
        Boche, Aaron Rudkin &amp; Luke Sonnet (2026),{" "}
        <SourceLink href="https://voteview.com/"><em>Voteview: Congressional Roll-Call Votes Database</em></SourceLink>
        . Biographical data:{" "}
        <SourceLink href="https://github.com/unitedstates/congress-legislators">@unitedstates/congress-legislators</SourceLink>
        . Member photos:{" "}
        <SourceLink href="https://github.com/unitedstates/images">@unitedstates/images</SourceLink>{" "}
        (public-domain GPO portraits) and{" "}
        <SourceLink href="https://commons.wikimedia.org/">Wikimedia Commons</SourceLink>{" "}
        (public-domain portraits, preferred where they exist). Member bios:{" "}
        <SourceLink href="https://en.wikipedia.org/">Wikipedia</SourceLink>
        , text abridged, under{" "}
        <SourceLink href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</SourceLink>
        . DW‑NOMINATE scores estimate each
        member&rsquo;s revealed ideology from their voting record, not stated
        beliefs.
      </p>
    </footer>
  );
}
