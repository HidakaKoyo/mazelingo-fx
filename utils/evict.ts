/**
 * TTL + cap eviction shared by the translation cache and the Norma cache.
 * Both persist timestamped objects to chrome.storage and must drop expired
 * entries, then trim the oldest beyond a max-entry cap. Keeping the shape in
 * one place avoids the two caches drifting.
 */
export function evictEntries<T extends { timestamp: number }>(
  cache: Readonly<Record<string, T>>,
  ttlMs: number,
  maxEntries: number,
): Record<string, T> {
  const now = Date.now(),
    valid = Object.entries(cache).filter(
      ([, v]: readonly [string, T]) => now - v.timestamp < ttlMs,
    );
  if (valid.length > maxEntries) {
    valid.sort(
      (a: readonly [string, T], b: readonly [string, T]) => a[1].timestamp - b[1].timestamp,
    );
    valid.splice(0, valid.length - maxEntries);
  }
  return Object.fromEntries(valid);
}
