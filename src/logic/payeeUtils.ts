/**
 * Payee Utility Module
 * Handles payee cleaning, honorific stripping, token matching,
 * and canonical map construction for deduplicating payees in Summary and Reports.
 */

const HONORIFICS = new Set([
  'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.',
  'shri', 'sri', 'prof', 'prof.', 'ji', 'sir', 'madam', 'esq', 'esq.'
]);

/**
 * Format a raw payee name to standard Title Case with normalized spaces.
 */
export function cleanPayeeName(name: string | undefined | null): string {
  if (!name) return '';
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract core tokens from a cleaned payee name, stripping common honorifics.
 */
export function getCoreTokens(cleanName: string): string[] {
  if (!cleanName) return [];
  return cleanName
    .toLowerCase()
    .split(' ')
    .filter(t => t.length > 0 && !HONORIFICS.has(t));
}

export interface PayeeStats {
  rawVariants: Set<string>;
  cleanDisplay: string;
  coreTokens: string[];
  count: number;
  totalAmount: number;
}

/**
 * Checks if tokens A form a prefix or initial match for tokens B.
 * e.g., ['ashim'] matches ['ashim', 'das'] -> true
 * e.g., ['ashim', 'd'] matches ['ashim', 'das'] -> true
 */
function isTokenPrefixOrMatch(tokensA: string[], tokensB: string[]): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.length > tokensB.length) return false;

  for (let i = 0; i < tokensA.length; i++) {
    const a = tokensA[i];
    const b = tokensB[i];
    if (a === b) continue;
    // Check initial match (e.g. 'd' vs 'das')
    if (a.length === 1 && b.startsWith(a)) continue;
    return false;
  }
  return true;
}

/**
 * Builds a Map from any raw payee string to its canonical display name.
 * Accepts an array of transaction items with optional `party` and `amount`.
 */
export function buildPayeeCanonicalMap(
  transactions: Array<{ party?: string; amount?: number }>
): Map<string, string> {
  const map = new Map<string, string>();
  const statsMap = new Map<string, PayeeStats>();

  // 1. Group transaction stats by cleaned display name
  for (const tx of transactions) {
    if (!tx.party || typeof tx.party !== 'string') continue;
    const raw = tx.party.trim();
    if (!raw) continue;

    const clean = cleanPayeeName(raw);
    const amt = typeof tx.amount === 'number' && !isNaN(tx.amount) ? Math.abs(tx.amount) : 0;

    let stats = statsMap.get(clean);
    if (!stats) {
      stats = {
        rawVariants: new Set(),
        cleanDisplay: clean,
        coreTokens: getCoreTokens(clean),
        count: 0,
        totalAmount: 0,
      };
      statsMap.set(clean, stats);
    }
    stats.rawVariants.add(raw);
    stats.count += 1;
    stats.totalAmount += amt;
  }

  const allStats = Array.from(statsMap.values());

  // 2. Find canonical name for each cleaned name entry
  for (const item of allStats) {
    let bestCanonical = item.cleanDisplay;

    // Look for potential proper supersets (e.g., "Ashim" matching "Ashim Das")
    const supersetCandidates = allStats.filter(other => {
      if (other.cleanDisplay === item.cleanDisplay) return false;
      // other must have more tokens
      if (other.coreTokens.length <= item.coreTokens.length) return false;
      // item tokens must match prefix of other tokens
      return isTokenPrefixOrMatch(item.coreTokens, other.coreTokens);
    });

    if (supersetCandidates.length > 0) {
      // Pick the best candidate based on highest count, then total spend, then longest token length
      supersetCandidates.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
        return b.coreTokens.length - a.coreTokens.length;
      });
      bestCanonical = supersetCandidates[0].cleanDisplay;
    } else {
      // Look for identical core token matches (e.g. case differences, honorific variants)
      const identicalTokenCandidates = allStats.filter(other => {
        if (other.coreTokens.length !== item.coreTokens.length) return false;
        return item.coreTokens.every((t, idx) => t === other.coreTokens[idx]);
      });

      if (identicalTokenCandidates.length > 1) {
        identicalTokenCandidates.sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return b.totalAmount - a.totalAmount;
        });
        bestCanonical = identicalTokenCandidates[0].cleanDisplay;
      }
    }

    // Map all raw variants of `item` to `bestCanonical`
    for (const rawVar of item.rawVariants) {
      map.set(rawVar, bestCanonical);
    }
    map.set(item.cleanDisplay, bestCanonical);
    map.set(item.cleanDisplay.toLowerCase(), bestCanonical);
  }

  return map;
}

/**
 * Safely look up the canonical payee name for a raw string.
 */
export function getCanonicalPayee(
  rawName: string | undefined | null,
  canonicalMap?: Map<string, string>
): string {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  if (canonicalMap && canonicalMap.has(trimmed)) {
    return canonicalMap.get(trimmed)!;
  }
  const clean = cleanPayeeName(trimmed);
  if (canonicalMap && canonicalMap.has(clean)) {
    return canonicalMap.get(clean)!;
  }
  if (canonicalMap && canonicalMap.has(clean.toLowerCase())) {
    return canonicalMap.get(clean.toLowerCase())!;
  }
  return clean;
}
