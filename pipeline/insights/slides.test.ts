import { describe, expect, it } from "vitest";
import { slidesSection } from "./issue";
import { FOLDER, driveRoot, folderName, outputRoot, pending, slideUrls } from "./slides";

describe("insights:slides", () => {
  it("reads the slide links from an issue body in slide order, once each", () => {
    const body = ["x", ...slidesSection({ image: "a-b.png", slides: ["a-b-ig-2.png", "a-b-ig-10.png", "a-b-ig-1.png"] }, "https://raw.example/images/a-b.png"), "y"].join("\n");
    expect(slideUrls(body).map((u) => u.split("/").pop())).toEqual(["a-b-ig-1.png", "a-b-ig-2.png", "a-b-ig-10.png"]);
    expect(slideUrls("an older draft with no slides")).toEqual([]);
  });

  it("finds Google Drive for desktop's My Drive, or says there is none", () => {
    const at = (...present: string[]) => ({ exists: (p: string) => present.includes(p), list: () => ["GoogleDrive-b@x.com", "GoogleDrive-a@x.com", "OneDrive-Personal"] });
    const storage = "/h/Library/CloudStorage";
    const drive = at(storage, `${storage}/GoogleDrive-a@x.com/My Drive`);
    expect(driveRoot("/h", drive.exists, drive.list)).toBe(`${storage}/GoogleDrive-a@x.com/My Drive`);
    const old = at("/h/Google Drive/My Drive");
    expect(driveRoot("/h", old.exists, old.list)).toBe("/h/Google Drive/My Drive");
    expect(driveRoot("/h", () => false, () => [])).toBeNull();
  });

  it("names a draft's folder by day and draft, and picks the output folder in order", () => {
    expect(folderName({ id: "energy.spr:extreme_low:2026-10-16" }, "2026-10-29")).toBe("2026-10-29 energy-spr-extreme-low-2026-10-16");
    expect(outputRoot({ out: "/o", env: "/e", home: "/h", drive: "/d" })).toEqual({ dir: "/o", fellBack: false });
    expect(outputRoot({ env: "/e", home: "/h", drive: "/d" })).toEqual({ dir: "/e", fellBack: false });
    expect(outputRoot({ home: "/h", drive: "/d" })).toEqual({ dir: `/d/${FOLDER}`, fellBack: false });
    expect(outputRoot({ home: "/h", drive: null })).toEqual({ dir: `/h/Downloads/${FOLDER}`, fellBack: true });
  });
});

describe("insights:slides --approved", () => {
  const issue = (number: number, labels: string[], updatedAt: string) => ({ number, labels: labels.map((name) => ({ name })), updatedAt });
  const now = new Date("2026-10-29T12:00:00Z");

  it("picks approved, unexpired, unfetched issues from the last week, oldest first", () => {
    const issues = [
      issue(350, ["social-draft", "social-approved"], "2026-10-28T10:00:00Z"),
      issue(348, ["social-draft", "social-approved", "social-posted"], "2026-10-27T10:00:00Z"),
      issue(347, ["social-draft", "social-approved"], "2026-10-20T10:00:00Z"),
      issue(349, ["social-draft", "social-approved", "social-expired"], "2026-10-28T10:00:00Z"),
      issue(351, ["social-draft"], "2026-10-28T10:00:00Z"),
      issue(352, ["social-draft", "social-approved"], "2026-10-28T11:00:00Z"),
    ];
    expect(pending(issues, [352], now)).toEqual([348, 350]);
    expect(pending(issues, [], now, 14)).toEqual([347, 348, 350, 352]);
    expect(pending([], [], now)).toEqual([]);
  });
});
