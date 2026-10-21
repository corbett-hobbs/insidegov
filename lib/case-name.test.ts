import { describe, expect, it } from "vitest";
import { shortCaseName } from "./case-name";

describe("shortCaseName", () => {
  it("prefers the Wikipedia title, without its disambiguation", () => {
    expect(shortCaseName("Doud et al. v. Hodge", "Morey v. Doud (1957)")).toBe("Morey v. Doud");
  });
  it("cuts people to surnames and drops roles, et al. and party labels", () => {
    expect(shortCaseName("Michael J. Astrue, Commissioner of Social Security, Petitioner v. Karen K. Capato, on Behalf of B. N. C., et al.")).toBe("Astrue v. Capato");
    expect(shortCaseName("Gary E. Gisbrecht, Barbara A. Miller, and Nancy Sandine v. Jo Anne B. Barnhart, Commissioner of Social Security")).toBe("Gisbrecht v. Barnhart");
    expect(shortCaseName("Pottawattamie County, Iowa, et al., Petitioners v. Curtis W. McGhee, Jr., et al.")).toBe("Pottawattamie County v. McGhee");
    expect(shortCaseName("Duro v. Reina, Chief of Police, Salt River Department of Public Safety, et al.")).toBe("Duro v. Reina");
    expect(shortCaseName("Mosser, Successor Trustee, et al. v. Darrow, Former Trustee, et al.")).toBe("Mosser v. Darrow");
    expect(shortCaseName("Blaine Lafler, Petitioner v. Anthony Cooper")).toBe("Lafler v. Cooper");
    expect(shortCaseName("Beech Aircraft Corporation v. Rainey, John C., et al.")).toBe("Beech Aircraft Corp. v. Rainey");
  });
  it("keeps organisations, states and corporate suffixes whole", () => {
    expect(shortCaseName("Ohio Civil Rights Commission et al. v. Dayton Christian Schools, Inc., et al.")).toBe("Ohio Civil Rights Commission v. Dayton Christian Schools, Inc.");
    expect(shortCaseName("Warner Chappell Music v. Neal")).toBe("Warner Chappell Music v. Neal");
    expect(shortCaseName("Ramsey v. New York")).toBe("Ramsey v. New York");
  });
  it("cites agencies by their initials", () => {
    expect(shortCaseName("Fibreboard Paper Products Corp. v. National Labor Relations Board et al.")).toBe("Fibreboard Paper Products Corp. v. NLRB");
  });
});
