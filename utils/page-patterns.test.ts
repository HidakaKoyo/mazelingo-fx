import { describe, expect, it } from "vitest";
import {
  addPagePattern,
  getSitePattern,
  matchesPageList,
  removeSitePattern,
} from "./page-patterns";

const URL = "https://example.com/articles/1";

describe("page patterns", () => {
  it("uses the same origin pattern for a site", () => {
    expect(getSitePattern(URL)).toBe("https://example.com/*");
    expect(addPagePattern("https://other.test/*", getSitePattern(URL))).toBe(
      "https://other.test/*\nhttps://example.com/*",
    );
  });

  it("detects matching page-list entries", () => {
    expect(matchesPageList("https://example.com/*", URL)).toBe(true);
    expect(matchesPageList("https://other.test/*", URL)).toBe(false);
  });

  it("removes only the exact site entry", () => {
    expect(removeSitePattern("https://example.com/*\nhttps://other.test/*", URL)).toEqual({
      pageListInclude: "https://other.test/*",
      status: "removed",
    });
  });

  it("reports a broader match without changing it", () => {
    expect(removeSitePattern("https://*", URL)).toEqual({
      pageListInclude: "https://*",
      status: "broader-match",
    });
  });

  it("does not remove an exact entry while another entry still matches", () => {
    expect(removeSitePattern("https://*\nhttps://example.com/*", URL)).toEqual({
      pageListInclude: "https://*\nhttps://example.com/*",
      status: "broader-match",
    });
  });
});
