import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { site, siteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { GlobalFooter } from "@/components/GlobalFooter";
import { ScrollToTop } from "@/components/ScrollToTop";
import { BackLinkProvider } from "@/components/BackLinkContext";
import { OutboundLinkTracker } from "@/components/OutboundLinkTracker";
import { JsonLd } from "@/components/JsonLd";
import { EmbedMode } from "@/components/charts/EmbedMode";
import { EMBED_BOOT } from "@/lib/embed";
import { siteJsonLd } from "@/lib/structured-data";
import "./globals.css";

// Self-hosted (app/fonts, from Fontsource; SIL OFL) rather than next/font/google: the Google fetch at build time
// failed intermittently on Vercel and took the whole deployment down with it.
const newsreader = localFont({
  variable: "--font-newsreader",
  src: [
    { path: "./fonts/newsreader-latin-wght-normal.woff2", style: "normal", weight: "200 800" },
    { path: "./fonts/newsreader-latin-wght-italic.woff2", style: "italic", weight: "200 800" },
  ],
  display: "swap",
});

const plexSans = localFont({
  variable: "--font-plex-sans",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", style: "normal", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", style: "normal", weight: "600" },
  ],
  display: "swap",
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", style: "normal", weight: "500" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", style: "normal", weight: "600" },
  ],
  display: "swap",
});

const HEADLINE = site.homeTitle;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: HEADLINE,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: "Corbett Hobbs" }],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: HEADLINE,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: HEADLINE,
    description: site.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* An embedded chart (?embed=): hide the page before first paint and pick the theme (lib/embed.ts). */}
        <script dangerouslySetInnerHTML={{ __html: EMBED_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <JsonLd data={siteJsonLd()} />
        <BackLinkProvider>
          <ScrollToTop />
          <SiteHeader />
          {children}
          <GlobalFooter />
          <EmbedMode />
          <OutboundLinkTracker />
          <Analytics />
        </BackLinkProvider>
      </body>
    </html>
  );
}
