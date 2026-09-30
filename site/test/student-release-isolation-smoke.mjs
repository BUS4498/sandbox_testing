// Run only against a fresh loopback Wrangler fixture after applying migrations.
// Synthetic identities exercise application scoping; live Sites identity still needs a separate account check.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const base = process.env.STUDENT_RELEASE_SMOKE_BASE ?? "http://127.0.0.1:8799";
const url = new URL(base);
if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") throw new Error("The isolation smoke may run only on loopback HTTP.");
const fixture = `.wrangler/student-release-smoke`;
const owners = ["A", "B"].map((suffix) => `synthetic-release-${suffix}-${crypto.randomUUID()}`);
const now = new Date().toISOString();

function quote(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function seed(sql) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "dist/server/wrangler.json", "--persist-to", fixture, "--command", sql], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: `${process.cwd()}/.wrangler/config` },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
for (const [index, owner] of owners.entries()) {
  const id = crypto.randomUUID();
  const company = `Synthetic Company ${index === 0 ? "A" : "B"}`;
  const record = {
    opportunityId: id, recordVersion: 1, dateAdded: now, dateDiscovered: now.slice(0, 10), lastUpdated: now,
    lastVerified: now.slice(0, 10), lastAgentReview: now, company, roleTitle: "Information Systems Intern",
    location: "California", workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "Unknown",
    source: "Synthetic local fixture", postingUrl: `https://example.test/${index}/internship`, applicationUrl: "",
    employerPostingId: "", postingStatus: "ACTIVE", fitAssessment: "Synthetic fixture only.",
    fitEvidence: { requiredMatches: [], preferredMatches: [], gaps: [], unknowns: [], preferenceAlignment: [] },
    agentDecision: "MONITOR", decisionRationale: "Synthetic fixture only.", selectionEvidence: [],
    nextAction: "Review the synthetic fixture.", nextActionDate: "", unresolvedIssue: "", attentionRequired: false,
    applicationStatus: "NOT_STARTED", studentNotes: "", assessmentProfileMode: "SYNTHETIC_DEMONSTRATION",
  };
  seed(`INSERT INTO opportunities (id,owner_id,canonical_url,employer_posting_id,normalized_company,normalized_role,normalized_location,normalized_period,record_json,record_version,created_at,updated_at) VALUES (${quote(id)},${quote(owner)},${quote(record.postingUrl)},'',${quote(company.toLowerCase())},'information systems intern','california','summer 2027',${quote(JSON.stringify(record))},1,${quote(now)},${quote(now)})`);
}
for (let index = 0; index < 5; index++) seed(`INSERT INTO usage_admissions (id,owner_id,kind,usage_group,started_at) VALUES (${quote(crypto.randomUUID())},${quote(owners[0])},'COLLECTION','COLLECTION',${quote(now)})`);

function headers(owner) { return owner ? { "oai-authenticated-user-id": owner, "oai-authenticated-user-email": `${owner}@example.test`, Origin: url.origin } : { Origin: url.origin }; }
async function get(path, owner) { return fetch(`${base}${path}`, { headers: headers(owner) }); }
const anonymous = await get("/api/status");
assert.equal(anonymous.status, 401);
assert.equal((await get("/api/collection.xlsx")).status, 401);
assert.equal((await get("/api/reset-archives")).status, 401);

const statuses = await Promise.all(owners.map(async (owner) => {
  const response = await get("/api/status", owner);
  assert.equal(response.status, 200);
  return response.json();
}));
assert.equal(statuses[0].opportunities.length, 1);
assert.equal(statuses[1].opportunities.length, 1);
assert.equal(statuses[0].opportunities[0].company, "Synthetic Company A");
assert.equal(statuses[1].opportunities[0].company, "Synthetic Company B");
assert.equal(statuses[0].collectAllowance.allowed, false);
assert.equal(statuses[1].collectAllowance.allowed, true);
for (const owner of owners) assert.equal((await get("/api/collection.xlsx", owner)).status, 200);

const reset = await fetch(`${base}/api/reset-collection`, { method: "POST", headers: { ...headers(owners[0]), "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "RESET" }) });
assert.equal(reset.status, 200, await reset.text());
const afterA = await (await get("/api/status", owners[0])).json();
const afterB = await (await get("/api/status", owners[1])).json();
assert.equal(afterA.opportunities.length, 0);
assert.equal(afterB.opportunities.length, 1);
assert.equal(afterA.collectAllowance.allowed, false, "Reset must not restore a billable Collect allowance.");
const archiveList = await (await get("/api/reset-archives", owners[0])).json();
assert.equal(archiveList.archives.length, 1);
const archiveId = archiveList.archives[0].id;
assert.equal((await get(`/api/reset-archives/${archiveId}`, owners[0])).status, 200);
assert.equal((await get(`/api/reset-archives/${archiveId}`, owners[1])).status, 404);
assert.equal((await (await get("/api/reset-archives", owners[1])).json()).archives.length, 0);
console.log("Student release smoke: sign-in required, records and archives isolated, other student unaffected by reset, and reset does not replenish Collect allowance.");
