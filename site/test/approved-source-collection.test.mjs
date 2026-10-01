import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Run the actual collection handlers with in-memory storage/provider adapters.
// No network, credentials, student records, or paid model requests are used.
const slot = Symbol.for("approved-source-collection-test");
const mockSource = `
const s = () => globalThis[Symbol.for("approved-source-collection-test")];
export const env = { DB: { prepare(sql) { let args; return {
  bind(...values) { args = values; return this; },
  async first() { return { job_json: JSON.stringify(s().job) }; },
  async run() { if (sql.startsWith("UPDATE runs SET job_json=?")) s().job = JSON.parse(args[0]); return { meta: { changes: 1 } }; }
}; } } };
export class HostedOpenAIError extends Error {}
export class UsageLimitError extends Error {}
export const discoveryPrompt = () => "mock public query";
export const realAssessmentPrompt = () => "mock private review";
export const runDiscovery = async () => ({ result: s().result, evidenceUrls: s().urls, observedSearches: 1 });
export const runPrivateAssessment = async (_prompt, result) => result;
export const readBackgroundAssessment = () => s().result;
export const readBackgroundDiscovery = () => null;
export const retrieveBackground = async () => ({});
export const startBackgroundAssessment = async () => "mock";
export const startBackgroundDiscovery = async () => "mock";
export const availableJevModel = async () => "jev-test";
export const scoreSavedOpportunity = async (_owner, id) => { s().scored.push(id); return { status: "SCORED", called: true }; };
export const getStudentSetup = async () => ({ ready: true, mode: "REAL", confirmedAt: "2026-09-30T00:00:00Z" });
export const collectionAllowance = async () => ({ allowed: true });
export const startRun = async () => s().run;
export const latestRun = async () => s().run;
export const listOpportunities = async () => s().saved;
export const canonicalUrl = (url) => new URL(url).href;
export const findDuplicate = async () => ({ classification: "NONE", record: null });
export const saveOpportunity = async (_owner, record) => { s().saved.push(record); return record; };
export const appendEvent = async (...args) => { s().events.push(args); };
export const finishRun = async (_owner, run) => { s().run = run; };
export const updateRun = async (_owner, run) => { s().run = run; };
`;
const mockUrl = "data:text/javascript;base64," + Buffer.from(mockSource).toString("base64");
const moduleCache = new Map();
function loadHandler(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  let code = ts.transpileModule(readFileSync(new URL("../lib/hosted/" + file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, specifier) => {
    const url = specifier === "./source-links.js"
      ? new URL("../lib/hosted/source-links.js", import.meta.url).href
      : specifier === "./collect" ? loadHandler("collect.ts") : mockUrl;
    return 'from "' + url + '"';
  });
  const url = "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  moduleCache.set(file, url);
  return url;
}
const syncHandler = await import(loadHandler("collect.ts"));
const resumableHandler = await import(loadHandler("collect-resumable.ts"));

test("exact selected identities are removed before private assessment, not similar role names", () => {
  const first = selection("https://simplify.jobs/p/first/Analyst-Intern");
  first.opportunity.employerPostingId = "verified-job-123";
  const crossSource = structuredClone(first);
  crossSource.opportunity.postingUrl = "https://jobs.lever.co/example/verified-job-123";
  const distinctJob = structuredClone(first);
  distinctJob.opportunity.postingUrl = "https://simplify.jobs/p/other/Analyst-Intern";
  distinctJob.opportunity.employerPostingId = "verified-job-456";
  const input = { selectedOpportunities: [first, crossSource, distinctJob],
    runSummary: { candidatesDiscovered: 3, duplicatesOrInvalid: 0, candidatesRanked: 3 }, unresolvedIssues: [] };
  const output = syncHandler.deduplicateSelectedDiscovery(input);
  assert.equal(output.removed, 1);
  assert.deepEqual(output.result.selectedOpportunities, [first, distinctJob]);
  assert.equal(output.result.runSummary.duplicatesOrInvalid, 1);
  assert.equal(input.selectedOpportunities.length, 3);
});

function selection(url = "https://simplify.jobs/p/123/Analyst-Intern", status = "UNCERTAIN") {
  return {
    updateDisposition: "NEW", existingOpportunityId: null,
    opportunity: { company: "Example", roleTitle: "Analyst Intern", postingUrl: url, source: "Simplify",
      postingStatus: status, deadline: "Unknown", location: "California", workArrangement: "Unknown",
      internshipPeriod: "Summer 2027", applicationUrl: "", employerPostingId: "", dateDiscovered: "2026-09-30",
      lastVerified: "2026-09-30", responsibilities: ["Analyze business data"],
      requiredQualifications: ["SQL"], preferredQualifications: [] },
    fitAssessment: "MODERATE", agentDecision: "MONITOR", decisionRationale: "Relevant SQL evidence; active status unknown.",
    fitEvidence: { requiredMatches: ["SQL project"], preferredMatches: [], gaps: ["Industry experience"], unknowns: ["Active status"], preferenceAlignment: ["Business analysis"] },
    selectionEvidence: ["Observed role-specific approved-source listing"],
    nextAction: "Check current availability before applying.", nextActionRequest: { prompt: "", responseType: "NONE" },
    nextActionDate: "", unresolvedIssue: "Active status unconfirmed", attentionRequired: false,
  };
}

async function runFixture(mode, selected, urls = selected.map((item) => item.opportunity.postingUrl)) {
  const result = { runSummary: { candidatesDiscovered: selected.length, duplicatesOrInvalid: 0, candidatesRanked: selected.length, selectionShortfallReason: "" }, selectedOpportunities: selected, unresolvedIssues: [] };
  const summary = { searchesPerformed: 1, candidatesDiscovered: selected.length, duplicatesOrInvalid: 0, candidatesRanked: selected.length, updatesSelected: selected.length, added: 0, updated: 0, duplicatesIgnored: 0, needsAttention: 0, notificationsSent: 0, scoresAdded: 0, scoresUnavailable: 0, unresolvedIssues: [], selectionShortfallReason: "", selected: [] };
  const state = { result, urls, saved: [], scored: [], events: [], run: { id: "fixture-run", kind: "COLLECTION", status: "IN_PROGRESS" },
    job: { phase: "PROCESS", responseId: null, phaseStartedAt: new Date().toISOString(), profileConfirmedAt: "2026-09-30T00:00:00Z",
      discovery: result, result, evidenceUrls: urls, observedSearches: 1, index: 0, processedUrls: [], pollFailures: 0, summary } };
  globalThis[slot] = state;
  if (mode === "sync") await syncHandler.collectOpportunities("fixture-student");
  else for (let i = 0; i <= selected.length; i++) await resumableHandler.advanceResumableCollection("fixture-student");
  return state;
}

for (const mode of ["sync", "resumable"]) {
  test(mode + ": saves and scores an approved listing despite unconfirmed employer status", async () => {
    const state = await runFixture(mode, [selection()]);
    assert.equal(state.saved.length, 1);
    assert.equal(state.saved[0].postingStatus, "UNCERTAIN");
    assert.equal(state.saved[0].deadline, "Unknown");
    assert.equal(state.scored.length, 1);
    assert.equal(state.run.summary.added, 1);
    assert.equal(state.run.summary.scoresAdded, 1);
    assert.notEqual(state.run.status, "FAILURE");
  });
  test(mode + ": rejects closed/index/unsupported listings without writes or scores", async () => {
    const state = await runFixture(mode, [
      selection("https://simplify.jobs/p/closed/Analyst-Intern", "CLOSED"),
      selection("https://simplify.jobs/l/Top-Summer-Internships-2027"),
      selection("https://simplify.jobs.evil.example/p/123"),
    ]);
    assert.equal(state.saved.length, 0);
    assert.equal(state.scored.length, 0);
  });
  test(mode + ": retains exact-source guard and duplicate suppression", async () => {
    const missing = await runFixture(mode, [selection()], []);
    assert.equal(missing.saved.length, 0);
    const duplicate = await runFixture(mode, [selection(), selection()]);
    assert.equal(duplicate.saved.length, 1);
    assert.equal(duplicate.scored.length, 1);
    assert.equal(duplicate.run.summary.duplicatesIgnored, 1);
  });
}
