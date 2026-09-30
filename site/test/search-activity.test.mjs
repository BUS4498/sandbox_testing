import assert from "node:assert/strict";
import { test } from "node:test";
import { applyObservedSearchCount, observedSearchActionCount } from "../lib/hosted/search-activity.js";
import { parseAndValidateWorkflowResult } from "../lib/hosted/specs/workflow-result-contract.js";

test("one search action counts once even when it contains four query variants", () => {
  assert.equal(observedSearchActionCount([
    { type: "web_search_call", action: { type: "search", queries: ["a", "b", "c", "d"] } },
  ]), 1);
});

test("counts search actions across calls but not page navigation", () => {
  assert.equal(observedSearchActionCount([
    { type: "web_search_call", action: { type: "search", queries: ["a", "b"] } },
    { type: "web_search_call", action: { type: "open_page", url: "https://example.com" } },
    { type: "web_search_call", action: { type: "find_in_page", pattern: "intern" } },
    { type: "web_search_call", action: { type: "search", query: "legacy query" } },
  ]), 2);
});

test("counts a search action without query details conservatively", () => {
  assert.equal(observedSearchActionCount([
    { type: "web_search_call", action: { type: "search", queries: [] } },
    { type: "web_search_call" },
  ]), 2);
});

test("eleven distinct search actions exceed the ten-call guard", () => {
  assert.equal(observedSearchActionCount(Array.from({ length: 11 }, () => (
    { type: "web_search_call", action: { type: "search", queries: ["one"] } }
  ))), 11);
});

test("discovery accepts ten observed searches but rejects eleven", () => {
  const result = (searchesPerformed) => JSON.stringify({
    schemaVersion: 1,
    runSummary: { searchesPerformed, candidatesDiscovered: 0, duplicatesOrInvalid: 0, candidatesRanked: 0, selectionShortfallReason: "No qualifying postings in this bounded test." },
    selectedOpportunities: [], unresolvedIssues: [],
  });
  assert.equal(parseAndValidateWorkflowResult(result(10), { observedSearches: 10 }).runSummary.searchesPerformed, 10);
  assert.throws(() => parseAndValidateWorkflowResult(result(11), { observedSearches: 11 }), /searchesPerformed|search/i);
});

test("contract uses observed actions rather than model-reported query variants", () => {
  const modelResult = {
    schemaVersion: 1,
    runSummary: { searchesPerformed: 4, candidatesDiscovered: 0, duplicatesOrInvalid: 0, candidatesRanked: 0, selectionShortfallReason: "No qualifying postings" },
    selectedOpportunities: [],
    unresolvedIssues: [],
  };
  const validated = parseAndValidateWorkflowResult(applyObservedSearchCount(JSON.stringify(modelResult), 1), { observedSearches: 1, mode: "DISCOVERY" });
  assert.equal(validated.runSummary.searchesPerformed, 1);
});

test("missing search count is not fabricated", () => {
  const incomplete = JSON.stringify({ runSummary: { candidatesDiscovered: 0 } });
  assert.equal(applyObservedSearchCount(incomplete, 1), incomplete);
});

test("invalid JSON remains invalid for the normal validator", () => {
  assert.equal(applyObservedSearchCount("{broken", 1), "{broken");
});
