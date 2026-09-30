/**
 * The approved budget counts hosted search actions, not query variants within
 * one action. Page opens and in-page finds are not targeted search actions.
 *
 * @param {unknown[]} output
 */
export function observedSearchActionCount(output) {
  let count = 0;
  for (const item of output) {
    if (!item || typeof item !== "object" || item.type !== "web_search_call") continue;
    const action = item.action;
    if (action && typeof action === "object" && action.type && action.type !== "search") continue;
    count++;
  }
  return count;
}

/**
 * Search counts are controller observations, not model judgments. Replace only
 * an existing summary count so missing or malformed result structure still
 * fails normal contract validation. Never store the raw response.
 *
 * @param {string} text
 * @param {number} observedSearches
 */
export function applyObservedSearchCount(text, observedSearches) {
  let result;
  try { result = JSON.parse(text); } catch { return text; }
  if (!result || typeof result !== "object" || Array.isArray(result)) return text;
  const summary = result.runSummary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary) || !Object.hasOwn(summary, "searchesPerformed")) return text;
  summary.searchesPerformed = observedSearches;
  return JSON.stringify(result);
}
