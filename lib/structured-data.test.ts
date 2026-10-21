import { describe, expect, it } from "vitest";
import { datasetJsonLd, datasetPaths, legislationJsonLd, personJsonLd, serializeJsonLd, siteJsonLd } from "./structured-data";
import { methodDescription } from "./methodology-description";

describe("serializeJsonLd", () => {
  it("escapes < so a value cannot close the script tag", () => {
    expect(serializeJsonLd({ name: "</script><b>" })).not.toContain("<");
  });
});

describe("siteJsonLd", () => {
  it("emits an Organization and a WebSite that reference each other", () => {
    const [org, web] = siteJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(web["@type"]).toBe("WebSite");
    expect(web.publisher).toEqual({ "@id": org["@id"] });
  });
});

describe("datasetJsonLd", () => {
  it("has markup for every topic page, with sources from the Methodology content", () => {
    for (const path of datasetPaths()) {
      const d = datasetJsonLd(path, { description: methodDescription(path) });
      expect(d?.["@type"]).toBe("Dataset");
      expect(String(d?.description).length).toBeGreaterThan(20);
      expect((d?.creator as unknown[]).length).toBeGreaterThan(0);
    }
  });
  it("closes the coverage window at the data date, or leaves it open", () => {
    expect(datasetJsonLd("/presidency/trade", { description: "x", dateModified: new Date("2026-08-01") })?.temporalCoverage).toBe("1991-01/2026-08-01");
    expect(datasetJsonLd("/presidency/trade", { description: "x" })?.temporalCoverage).toBe("1991-01/..");
  });
  it("is null for a path without a dataset", () => {
    expect(datasetJsonLd("/about", { description: "x" })).toBeNull();
  });
});

describe("personJsonLd and legislationJsonLd", () => {
  it("builds absolute urls and drops empty optionals", () => {
    const p = personJsonLd({ path: "/x", name: "A B", jobTitle: "J", description: "d" });
    expect(String(p.url)).toMatch(/\/x$/);
    expect(p).not.toHaveProperty("image");
    const l = legislationJsonLd({ path: "/l", name: "N", publicLaw: "Public Law 1-2", congressLabel: "1st", date: "2020-01-01" });
    expect(l["@type"]).toBe("Legislation");
  });
});
