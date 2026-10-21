import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { Suspense } from "react";
import { ContactForm } from "@/components/ContactForm";
import { PageHeader } from "@/components/PageHeader";

const DESCRIPTION = "Report a number that looks wrong, ask a question, or send an idea about InsideGov.";

export const metadata: Metadata = pageMetadata({
  title: "Contact and Corrections",
  description: DESCRIPTION,
  path: "/contact",
});

const LINK =
  "text-accent underline underline-offset-2 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <PageHeader title="Contact and corrections">
        <p>Use this form to report a number that looks wrong, ask a question, or send an idea.</p>
        <p>
          Before reporting an error, check{" "}
          <Link href="/methodology" className={LINK}>
            Methodology and sources
          </Link>
          . Many figures that look off are documented, such as net worth shown as a range, preliminary data that gets
          revised, and counting rules that changed over time.
        </p>
      </PageHeader>
      <Suspense fallback={null}>
        <ContactForm />
      </Suspense>
    </main>
  );
}
