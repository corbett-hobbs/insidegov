import { JsonLd } from "@/components/JsonLd";
import { branchFreshness, type Branch } from "@/lib/data-freshness";
import { datasetJsonLd } from "@/lib/structured-data";
import { methodDescription } from "@/lib/methodology-description";

/** `Dataset` JSON-LD for a topic page (`/presidency/economy`, ...): sources and cadence from the Methodology content, date from the pipeline reports. */
export function TopicDatasetLd({ path }: { path: string }) {
  const branch = path.split("/")[1];
  const key: Branch = branch === "congress" ? "congress" : branch === "supreme-court" ? "court" : "presidency";
  return <JsonLd data={datasetJsonLd(path, { description: methodDescription(path), dateModified: branchFreshness(key) })} />;
}
