/**
 * Dedup utilities — string normalization, name similarity, geo distance.
 *
 * Used by scripts/discover.mjs to:
 *   1. merge raw candidates from multiple sources within a batch,
 *   2. drop candidates that match an existing DB row,
 *   3. drop candidates that match a previously-rejected entry in
 *      data/discovery/ignored.json.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an',
  'de', 'het', 'een', 'der', 'den',
  'van', 'der', 'op', 'aan', 'in',
  'museum', 'centrum', 'centre', 'center',
  'castle', 'kasteel', 'slot',
  'church', 'kerk', 'cathedral',
  'national', 'nationaal', 'park',
  'and', 'en',
]);

const DIACRITICS = /[̀-ͯ]/g;

/** lower-case, strip diacritics, drop punctuation, drop stop-words. */
export function normalizeName(s) {
  if (!s) return '';
  const decomposed = s.normalize('NFD').replace(DIACRITICS, '');
  const tokens = decomposed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
  return tokens.join(' ');
}

/** Token-set Jaccard. */
export function tokenJaccard(a, b) {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean));
  if (!ta.size && !tb.size) return 1;
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return inter / union;
}

/** Levenshtein-based ratio (1 - dist / maxLen). */
export function levenshteinRatio(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  const m = x.length, n = y.length;
  const prev = new Array(n + 1).fill(0).map((_, j) => j);
  const cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return 1 - prev[n] / Math.max(m, n);
}

/** Best of two — robust to word reordering and to spelling variation. */
export function nameSimilarity(a, b) {
  return Math.max(tokenJaccard(a, b), levenshteinRatio(a, b));
}

/** Haversine distance in meters. */
export function haversine(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lng)) return Infinity;
  if (!Number.isFinite(b?.lat) || !Number.isFinite(b?.lng)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * "Are these two candidates the same place?"
 *
 * Geo-anchored when both have coordinates:
 *   < 100m   → yes (regardless of name)
 *   < 500m   → yes if name similarity ≥ 0.6
 *   ≥ 500m   → no
 *
 * Name-only fallback:                 ≥ 0.85
 */
export function isSameCandidate(a, b) {
  const aCoords = { lat: a.lat ?? a.hint_lat, lng: a.lng ?? a.hint_lng };
  const bCoords = { lat: b.lat ?? b.hint_lat, lng: b.lng ?? b.hint_lng };
  const haveBoth =
    Number.isFinite(aCoords.lat) && Number.isFinite(bCoords.lat);
  if (haveBoth) {
    const d = haversine(aCoords, bCoords);
    if (d < 100) return true;
    if (d < 500) return nameSimilarity(a.name, b.name) >= 0.6;
    return false;
  }
  return nameSimilarity(a.name, b.name) >= 0.85;
}
