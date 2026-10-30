import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SocialLinkList } from "@/components/SocialLinkList";
import { siteInfo, socialLinks } from "@/lib/site-info";

const DESCRIPTION =
  "InsideGov charts the data behind the news, from gas prices and tariffs to new laws and Supreme Court rulings, drawn straight from public government records.";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: DESCRIPTION,
  path: "/about",
});

const QUESTIONS = [
  "How have jobs, inflation, gas prices, mortgage rates and the deficit moved from one administration to the next?",
  "What does the U.S. trade, with whom, and how have tariffs changed?",
  "How many people are removed, get green cards, become citizens or arrive as refugees each year?",
  "Where do U.S. troops and foreign aid go, and how has that changed?",
  "How many executive orders has each president signed, and on what topics?",
  "How divided is Congress, and does my state’s delegation vote as a bloc?",
  "Which laws has Congress passed, and who voted for them?",
  "What has the Supreme Court decided, and how has its middle moved over time?",
];

const LINK =
  "text-accent underline underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 font-serif text-[1.3rem] font-medium leading-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  const { fundingStatement, builderName, githubUrl } = siteInfo;
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <PageHeader title="About InsideGov">
        <p>
          InsideGov is a companion to the news. When a story is about gas prices, mortgage rates, tariffs, deportations, the
          deficit, a new law or a Supreme Court ruling, this is where you can see the numbers behind it, charted from the government&rsquo;s own records
          on the presidency, Congress and the Supreme Court.
        </p>
      </PageHeader>

      <div className="flex flex-col gap-7 text-[0.95rem] leading-[1.65] [&_p]:m-0">
        <Section title="Why I built this">
          <p>
            Much of the news cycle is about numbers. Gas prices and mortgage rates come up constantly. Tariffs make
            headlines whenever a new round is announced. Deportations stay in the news as ICE enforcement shifts. The
            deficit is a slower-burning story that resurfaces with each budget fight. Congress makes news when a major
            bill passes, and the vote count shows how much support it really had. The Supreme Court&rsquo;s biggest
            rulings arrive each June, and the headline is often the split. Articles quote those figures, but
            they rarely show them in context. You read that something rose or fell without seeing how it compares with last year or with
            the last administration. I wanted one place where anyone following the news can pull up the chart and see
            the trend for themselves.
          </p>
          <p>
            Almost everything the federal government does leaves a public record: roll-call votes, executive orders,
            financial disclosures, trade statistics, court decisions, troop counts. Very little of it is easy to read.
            It is spread across dozens of agencies and published in formats meant for specialists. InsideGov does the
            work of lining it up once, in the open, so anyone can see what the records show.
          </p>
        </Section>

        <Section title="Questions it helps answer">
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
            {QUESTIONS.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Section>

        <Section title="How it’s made and how to read it">
          <p>
            Every number comes from a named public source through an automated, checked pipeline, and the code and data
            are open on <a href={githubUrl} className={LINK}>GitHub</a>. I choose the questions and the sources, and
            Claude writes the code. Each chart has Data notes saying what it
            measures and what to be careful about. The charts describe what the records show; they don’t claim that a
            president or party caused it. <Link href="/methodology" className={LINK}>Methodology and sources</Link>{" "}
            has the detail.
          </p>
        </Section>

        {socialLinks().length > 0 && (
          <Section title="Follow along">
            <p>
              A chart is posted on <SocialLinkList className={LINK} /> whenever new government data comes out. When
              something like tariffs or gas prices is in the news, a chart showing how it has changed over the years
              is posted too. Every number is checked against the source before it goes up, and the full data is here on the
              site.
            </p>
          </Section>
        )}

        <Section title="Independence">
          <p>
            InsideGov is not affiliated with, endorsed by, or funded by any government agency, party, campaign or
            advocacy group. {fundingStatement}
          </p>
        </Section>

        <Section title="Who’s behind it">
          <p>
            InsideGov is built and maintained by{" "}
            <a href="https://corbetthobbs.com" className={LINK}>{builderName}</a>. I studied international politics at Georgetown’s
            School of Foreign Service and worked in a U.S. Senate press office. In 2013 I launched the original
            InsideGov.com at Graphiq, a company that turned large public datasets into charts anyone could browse or
            embed. Amazon acquired Graphiq in 2017 to help power Alexa’s answers.
          </p>
          <p>
            Bringing InsideGov back has been a passion project. This version is entirely my own, so it can grow at its
            own pace.
          </p>
        </Section>
      </div>
    </main>
  );
}
