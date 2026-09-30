// Run only against a separate local Wrangler D1 fixture after migrations.
import assert from "node:assert/strict";

const base = process.env.PROFILE_SMOKE_BASE ?? "http://127.0.0.1:8799";
const url = new URL(base);
if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") throw new Error("This smoke test may run only on loopback HTTP.");
const headers = {
  "oai-authenticated-user-id": "synthetic-profile-smoke-owner",
  "oai-authenticated-user-email": "synthetic-owner@example.test",
  Origin: url.origin,
  "Content-Type": "application/json",
};
async function status() {
  const response = await fetch(`${base}/api/status`, { headers });
  assert.equal(response.status, 200);
  return response.json();
}
async function post(body) {
  const response = await fetch(`${base}/api/student-setup`, { method: "POST", headers, body: JSON.stringify(body) });
  return { code: response.status, data: await response.json() };
}

const sample = {
  action: "SAVE_REAL",
  profileText: "Synthetic junior Information Systems student with SQL, Excel, and Power BI coursework and a process-mapping project.",
  confirmedNoIdentifiers: true,
  apiAssessmentConsent: true,
  roles: ["AI Business Analyst Intern"],
  availableFrom: "2027-05-24",
  availableThrough: "2027-08-20",
  hoursPerWeek: 40,
  paidPreference: "PREFERRED",
  relocationFlexibility: "NO",
  workAuthorization: "UNSURE_OR_PREFER_NOT_TO_STATE",
  workArrangements: ["HYBRID"],
  geographicBoundaries: "California",
};

assert.equal((await status()).setup.mode, "UNSELECTED");
assert.equal((await post({ ...sample, confirmedNoIdentifiers: false })).code, 400);
const saved = await post(sample);
assert.equal(saved.code, 200, JSON.stringify(saved.data));
assert.equal(saved.data.setup.mode, "REAL");
assert.equal(saved.data.setup.ready, true);
assert.equal((await status()).setup.profileText, sample.profileText);
const demo = await post({ action: "USE_DEMO" });
assert.equal(demo.code, 200);
assert.equal(demo.data.setup.mode, "SYNTHETIC_DEMONSTRATION");
assert.equal(demo.data.setup.profileText, sample.profileText);
const realAgain = await post({ action: "USE_REAL" });
assert.equal(realAgain.data.setup.mode, "REAL");
const removed = await post({ action: "DELETE_REAL", confirmation: "DELETE" });
assert.equal(removed.code, 200);
assert.equal(removed.data.setup.mode, "UNSELECTED");
assert.equal(removed.data.setup.profileText, "");
assert.equal((await status()).setup.ready, false);
console.log("Student setup API smoke: confirmed real setup, mode switch, and deletion passed on synthetic loopback fixture.");
