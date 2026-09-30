// Run only against a separate loopback Wrangler fixture after applying migrations.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = process.env.TARGETED_SMOKE_BASE ?? "http://127.0.0.1:8799";
const url = new URL(base);
if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") throw new Error("This smoke test may run only on loopback HTTP.");
const ownerId = `synthetic-targeted-smoke-${crypto.randomUUID()}`;
const opportunityId = crypto.randomUUID();
const now = new Date().toISOString();
const record = {
  opportunityId, recordVersion: 1, dateAdded: now, dateDiscovered: now.slice(0, 10), lastUpdated: now,
  lastVerified: now.slice(0, 10), lastAgentReview: now, company: "Example Analytics",
  roleTitle: "Business Systems Intern", location: "Los Angeles, CA", workArrangement: "Hybrid",
  internshipPeriod: "Summer 2027", deadline: "Unknown", source: "Synthetic local fixture",
  postingUrl: "https://example.test/internships/business-systems-2027", applicationUrl: "", employerPostingId: "",
  postingStatus: "ACTIVE", fitAssessment: "Provisional synthetic fit assessment.",
  fitEvidence: { requiredMatches: ["Synthetic SQL project"], preferredMatches: [], gaps: ["Location feasibility unconfirmed"], unknowns: [], preferenceAlignment: [] },
  agentDecision: "MONITOR", decisionRationale: "Student location feasibility is unconfirmed.", selectionEvidence: ["Synthetic fixture only"],
  nextAction: "Ask the student whether Los Angeles is feasible.",
  nextActionRequest: { prompt: "Can you work in Los Angeles for Summer 2027?", responseType: "TEXT", options: [], whatHappensNext: "The agent will reassess this opportunity." },
  nextActionDate: "", unresolvedIssue: "Location feasibility unknown.", attentionRequired: true,
  applicationStatus: "NOT_STARTED", studentNotes: "", assessmentProfileMode: "SYNTHETIC_DEMONSTRATION",
};
const sqlText = `INSERT OR IGNORE INTO opportunities (id,owner_id,canonical_url,employer_posting_id,normalized_company,normalized_role,normalized_location,normalized_period,record_json,record_version,created_at,updated_at) VALUES ('${opportunityId}','${ownerId}','${record.postingUrl}','','example analytics','business systems intern','los angeles ca','summer 2027','${JSON.stringify(record).replaceAll("'", "''")}',1,'${now}','${now}')`;
const seed = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "dist/server/wrangler.json", "--persist-to", ".wrangler/targeted-fixture", "--command", sqlText], { encoding: "utf8" });
assert.equal(seed.status, 0, seed.stderr || seed.stdout);

const headers = { "oai-authenticated-user-id": ownerId, "oai-authenticated-user-email": "synthetic-owner@example.test", Origin: url.origin, "Content-Type": "application/json" };
async function post(path, body) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function status() {
  const response = await fetch(`${base}/api/status`, { headers });
  assert.equal(response.status, 200);
  return response.json();
}

assert.equal((await post("/api/student-setup", { action: "USE_DEMO" })).status, 200);
const before = await status();
assert.equal(before.opportunities.length, 1);
const updated = await post("/api/opportunities/update", {
  action: "SAVE_AND_UPDATE", opportunityId, recordVersion: before.opportunities[0].recordVersion,
  responseType: "NOT_INTERESTED", responseText: "", apiAssessmentConsent: false,
});
assert.equal(updated.status, 200, JSON.stringify(updated.data));
assert.equal(updated.data.run.kind, "TARGETED_UPDATE");
assert.equal(updated.data.run.summary.searchesPerformed, 0);
const after = await status();
assert.equal(after.opportunities.length, 1);
assert.equal(after.opportunities[0].agentDecision, "ARCHIVE");
assert.equal(after.opportunities[0].applicationStatus, "NOT_INTERESTED");
assert.equal(after.studentResponses.length, 1);
assert.equal(after.studentResponses[0].status, "COMPLETE");
assert.equal(after.opportunities[0].lastProcessedResponseId, after.studentResponses[0].id);
const duplicate = await post("/api/opportunities/update", { action: "RETRY", opportunityId, responseId: after.studentResponses[0].id });
assert.equal(duplicate.status, 409);
console.log("Targeted update smoke: one saved response, one verified record, zero web searches, and duplicate retry blocked.");
