import { compilePageList } from "./content-logic";

export function getSitePattern(url: string): string {
  return `${new URL(url).origin}/*`;
}

export function splitPagePatterns(list: string): string[] {
  return list
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function addPagePattern(list: string, pattern: string): string {
  const patterns = splitPagePatterns(list);
  if (!patterns.includes(pattern)) patterns.push(pattern);
  return patterns.join("\n");
}

export function matchesPageList(list: string, url: string): boolean {
  return compilePageList(list).some((matcher) => matcher.regex.test(url));
}

export type RemoveSitePatternResult =
  | { status: "removed"; pageListInclude: string }
  | { status: "not-matched"; pageListInclude: string }
  | { status: "broader-match"; pageListInclude: string };

export function removeSitePattern(list: string, url: string): RemoveSitePatternResult {
  const patterns = splitPagePatterns(list);
  const sitePattern = getSitePattern(url);
  if (patterns.includes(sitePattern)) {
    const otherPatterns = patterns.filter((pattern) => pattern !== sitePattern);
    if (matchesPageList(otherPatterns.join("\n"), url)) {
      return { pageListInclude: list, status: "broader-match" };
    }
    return {
      pageListInclude: otherPatterns.join("\n"),
      status: "removed",
    };
  }
  return {
    pageListInclude: list,
    status: matchesPageList(list, url) ? "broader-match" : "not-matched",
  };
}
