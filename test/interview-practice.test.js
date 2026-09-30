import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OpenAIResponsesClient } from "../src/controller/openai-responses-client.js";
import { RunNowManager } from "../src/controller/run-now-manager.js";
import { validateInterviewResult, verifyInterviewReports } from "../src/controller/interview-practice-contract.js";
import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";

test("interview source checks separate reported from merely likely questions", async () => {
  const url = "https://www.reddit.com/r/careers/comments/example/";
  const input = { reportedQuestions: [{ question: "Describe a process improvement.", sourceUrl: url, sourceName: "Candidate report", sourceDate: "2026", roleMatch: "EXACT_ROLE", evidenceQuote: "They asked about process improvement." }], reportedProcess: [{ description: "A recruiter screen came first.", sourceUrl: url, sourceName: "Candidate report", sourceDate: "2026", roleMatch: "EXACT_ROLE", sourceKind: "CANDIDATE_REPORT", evidenceQuote: "The recruiter screen came first." }], likelyQuestions: ["How would you test a new workflow?"], generalProcessGuidance: ["Ask the recruiter to confirm stages."], searchNotes: "Candidate account." };
  assert.equal(validateInterviewResult(input, []).reportedQuestions.length, 0);
  const parsed = validateInterviewResult(input, [url]);
  const checked = await verifyInterviewReports(parsed, { company: "Acme", roleTitle: "AI Analyst Intern", fetchPage: async () => new Response("<html>At Acme they asked about process improvement. The recruiter screen came first.</html>", { headers: { "content-type": "text/html" } }) });
  assert.equal(checked.reportedQuestions.length, 1);
  assert.equal(checked.reportedProcess.length, 1);
  assert.equal(checked.sourcesInspected, 1);
  assert.equal(checked.reportedQuestions[0].roleMatch, "RELATED_ROLE");
  const inaccessible = await verifyInterviewReports(parsed, { company: "Acme", fetchPage: async () => new Response("Sign in", { status: 403, headers: { "content-type": "text/html" } }) });
  assert.equal(inaccessible.reportedQuestions.length, 0);
  assert.equal(inaccessible.reportedProcess.length, 0);
  assert.equal(validateInterviewResult({ ...input, reportedProcess: [{ ...input.reportedProcess[0], sourceKind: "EMPLOYER_GUIDANCE" }] }, [url]).reportedProcess.length, 0);
});

test("on-demand API research sends only public role facts and enforces the separate budget", async () => {
  const requests = [];
  const client = new OpenAIResponsesClient({ apiKey: "sk-synthetic-key-with-enough-characters", model: "test-model", clientFactory: () => ({ responses: { create: async (value) => {
    requests.push(value);
    return { id: `resp_interview_${requests.length}`, status: "completed", output_text: JSON.stringify({ reportedQuestions: [], reportedProcess: [], likelyQuestions: requests.length === 1 ? ["How would you define requirements?"] : [], generalProcessGuidance: requests.length === 2 ? ["Ask the recruiter to confirm stages."] : [], searchNotes: "No report." }), output: [{ type: "web_search_call", action: { type: "search", sources: [] } }] };
  } } }) });
  const result = await client.runInterviewResearch({ company: "Acme", roleTitle: "AI Analyst Intern", location: "California", postingUrl: "https://example.com/job" });
  assert.equal(result.searchesPerformed, 2);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((request) => request.max_tool_calls === 1));
  assert.match(requests[0].input, /candidate-reported questions/);
  assert.match(requests[1].input, /interview stages/);
  assert.ok(requests.every((request) => !/Morgan Rivera|resume evidence|student profile text/i.test(request.input)));
  assert.equal(requests[0].text.format.name, "interview_practice_result");
});

test("Practice Interview saves a separate Word set and memory without updating the collection", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "internship-interview-test-"));
  const memoryStore = await new OperationalMemoryStore({ rootDir: path.join(root, "memory") }).initialize();
  const applicationMaterialStore = await new LocalApplicationMaterialStore({ rootDir: path.join(root, "materials") }).initialize();
  const opportunity = { opportunityId: "opp-interview-test", company: "Acme", roleTitle: "AI Business Analyst Intern", location: "California", postingUrl: "https://example.com/job", lastUpdated: "2026-09-28" };
  let writes = 0;
  const spreadsheetTracker = { async getOpportunity() { return opportunity; }, async readRecords() { writes++; throw new Error("Collection should not be processed."); } };
  const client = { async readiness() { return { status: "READY" }; }, async runInterviewResearch() { return { reportedQuestions: [], reportedProcess: [], likelyQuestions: ["How would you document requirements?"], generalProcessGuidance: ["Ask the recruiter to confirm stages."], searchNotes: "No reported questions verified.", searchesPerformed: 2, sourcesInspected: 0, responseId: "resp_test" }; }, async close() {} };
  const studentProfileStore = { async snapshot() { return { readyForCollection: true, mode: "DEMO", activeLabel: "Synthetic demonstration", missingItems: [] }; } };
  const manager = new RunNowManager({ workspaceRoot: root, memoryStore, spreadsheetTracker, applicationMaterialStore, studentProfileStore, clientFactory: () => client });
  try {
    const started = manager.startInterviewPractice({ opportunityId: opportunity.opportunityId, opportunity });
    const done = await manager.waitForRun(started.runId);
    assert.equal(done.outcome, "SUCCESS");
    assert.equal(done.workflowType, "INTERVIEW");
    assert.equal(done.interviewLikely, 1);
    assert.equal(done.interviewProcess, 0);
    assert.equal(writes, 0);
    const materials = await applicationMaterialStore.listMaterials({ opportunityId: opportunity.opportunityId });
    assert.equal(materials.length, 1);
    assert.equal(materials[0].type, "INTERVIEW_PRACTICE");
    assert.equal(materials[0].practiceResult.likelyQuestions.length, 1);
    assert.equal(materials[0].practiceResult.generalProcessGuidance.length, 1);
    assert.equal((await applicationMaterialStore.readMaterial(materials[0].materialId)).verified, true);
    assert.equal((await memoryStore.list("action", { runId: started.runId }))[0].actionType, "INTERVIEW_PRACTICE_SAVED");
  } finally { await manager.close(); await rm(root, { recursive: true, force: true }); }
});
