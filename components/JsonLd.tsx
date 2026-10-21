import { serializeJsonLd, type JsonLdNode } from "@/lib/structured-data";

/** Renders one or more schema.org nodes as `<script type="application/ld+json">` (server component, no client JS). */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
