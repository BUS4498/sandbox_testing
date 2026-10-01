import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSuggestionPreview, roleEvidence, roleProfileFingerprint, validateRoleSuggestions } from "../lib/hosted/role-suggestion-rules.js";
import { hostedTestRuntime } from "./support/hosted-test-runtime.mjs";

const profile = "B.S. Biology\nCoursework in cell biology and laboratory methods.\nConducted a supervised bacterial-growth class experiment.\nSummarized laboratory results using Excel.";
const input = text => ({ profileText: text, confirmedNoIdentifiers: true, roleSuggestionConsent: true });
const suggestion = { title: "Laboratory Research Intern", reason: "Biology coursework and supervised experiments offer a starting point for laboratory research roles.", evidenceIds: ["R1", "R2"] };

test("review and separate suggestion consent precede a request; identifiers are rejected", () => {
  assert.equal(normalizeSuggestionPreview(input(profile)), profile);
  for (const data of [input("too short"), { ...input(profile), confirmedNoIdentifiers: false }, { ...input(profile), roleSuggestionConsent: false }, input(`${profile}\nstudent@example.org`)]) assert.throws(() => normalizeSuggestionPreview(data));
});
test("resume excerpts and returned evidence use actual supplied content, not default AI roles", async () => {
  const evidence = roleEvidence(profile);
  const result = validateRoleSuggestions({ suggestions: [suggestion] }, evidence);
  assert.equal(result[0].title, "Laboratory Research Intern");
  assert.deepEqual(result[0].evidence, evidence.slice(0, 2));
  assert.deepEqual(validateRoleSuggestions({ suggestions: [] }, evidence), []);
  assert.equal(await roleProfileFingerprint(` ${profile.replaceAll("\n", "\r\n")} `), await roleProfileFingerprint(profile));
  assert.notEqual(await roleProfileFingerprint(profile + "\nStatistics course"), await roleProfileFingerprint(profile));
});
test("unbounded, duplicate, senior, non-intern, identifying, or invented evidence results fail", () => {
  const evidence = roleEvidence(profile);
  for (const bad of [{ suggestions: Array(9).fill(suggestion) }, { suggestions: [suggestion, suggestion] },
    ...["Senior Laboratory Intern", "Research Director", "Laboratory Researcher"].map(title => ({ suggestions: [{ ...suggestion, title }] })),
    { suggestions: [{ ...suggestion, evidenceIds: ["R999"] }] }, { suggestions: [{ ...suggestion, reason: "Contact student@example.org to learn about this role." }] }]) {
    assert.throws(() => validateRoleSuggestions(bad, evidence));
  }
});
test("production adapters enforce auth, owner cache, five requests, no web, and no setup mutation", async () => {
  const runtime = await hostedTestRuntime();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.tools, undefined);
    assert.match(body.input, /B.S. Biology/); assert.equal(body.input.includes("student@example"), false);
    return Response.json({ status: "completed", output_text: JSON.stringify({ suggestions: [suggestion] }) });
  };
  const request = data => new Request("https://fixture.test/api/role-suggestions", { method: "POST", headers: { Origin: "https://fixture.test" }, body: JSON.stringify(data) });
  try {
    globalThis.__ROLE_TEST_USER__ = null;
    assert.equal((await runtime.api.POST(request(input(profile)))).status, 401);
    globalThis.__ROLE_TEST_USER__ = { userId: "fixture-student-a" };
    assert.equal((await runtime.api.POST(new Request("https://fixture.test/api/role-suggestions", { method: "POST", headers: { Origin: "https://other.test" } }))).status, 403);
    assert.equal((await runtime.api.POST(request({ ...input(profile), roleSuggestionConsent: false }))).status, 400);
    assert.equal(calls, 0);
    const first = await runtime.api.suggestResumeRoles("fixture-student-a", input(profile));
    assert.equal(first.cached, false); assert.equal(calls, 1);
    assert.equal((await runtime.api.suggestResumeRoles("fixture-student-a", input(profile))).cached, true);
    assert.equal(calls, 1);
    assert.equal(await runtime.api.readRoleSuggestionCache("fixture-student-b", first.profileFingerprint), null);
    const setup = await runtime.api.getStudentSetup("fixture-student-a");
    assert.equal(setup.mode, "UNSELECTED"); assert.equal(setup.ready, false);
    assert.equal((await runtime.api.latestRun("fixture-student-a")).kind, "ROLE_SUGGESTIONS");
    for (let index = 1; index < 5; index++) await runtime.api.suggestResumeRoles("fixture-student-a", input(profile + `\nStatistics project ${index}`));
    await assert.rejects(runtime.api.suggestResumeRoles("fixture-student-a", input(profile + "\nStatistics project 6")), /24-hour limit/);
    assert.equal(calls, 5);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM usage_admissions WHERE kind='COLLECTION'").get().count, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM student_setups").get().count, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM opportunities").get().count, 0);
    const other = await runtime.api.suggestResumeRoles("fixture-student-b", input(profile));
    assert.equal(calls, 6); assert.equal(other.cached, false);
    await runtime.api.deleteRoleSuggestionCache("fixture-student-a");
    assert.equal(await runtime.api.readRoleSuggestionCache("fixture-student-a", first.profileFingerprint), null);
    assert.ok(await runtime.api.readRoleSuggestionCache("fixture-student-b", other.profileFingerprint));
  } finally { globalThis.fetch = originalFetch; await runtime.close(); }
});

test("empty, malformed and failed provider replies are recoverable and do not activate setup", async () => {
  const runtime = await hostedTestRuntime(); const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ status: "completed", output_text: '{"suggestions":[]}' });
    const empty = await runtime.api.suggestResumeRoles("empty-fixture", input(profile));
    assert.deepEqual(empty.suggestions, []); assert.equal((await runtime.api.latestRun("empty-fixture")).status, "SUCCESS");
    globalThis.fetch = async () => Response.json({ status: "completed", output_text: '{"suggestions":[{"title":"Invented Intern","reason":"Unsupported evidence cannot be accepted.","evidenceIds":["R999"]}]}' });
    await assert.rejects(runtime.api.suggestResumeRoles("malformed-fixture", input(profile)));
    assert.equal((await runtime.api.latestRun("malformed-fixture")).status, "FAILURE");
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM run_locks").get().count, 0);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(runtime.api.suggestResumeRoles("failed-fixture", input(profile)));
    assert.equal((await runtime.api.getStudentSetup("failed-fixture")).mode, "UNSELECTED");
    assert.equal((await runtime.api.latestRun("failed-fixture")).status, "FAILURE");
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM run_locks").get().count, 0);
  } finally { globalThis.fetch = originalFetch; await runtime.close(); }
});

test("shared secondary ceiling also bounds new role requests before a model call", async () => {
  const runtime = await hostedTestRuntime(); const originalFetch = globalThis.fetch; let called = false;
  try {
    const now = new Date().toISOString();
    for (let index=0; index<100; index++) runtime.db.prepare("INSERT INTO usage_admissions (id,owner_id,kind,usage_group,started_at) VALUES (?,?,?,?,?)").run(`used-${index}`, `other-${index}`, "MATERIAL_PREP", "SECONDARY", now);
    globalThis.fetch = async () => { called = true; throw new Error("Must not call provider"); };
    await assert.rejects(runtime.api.suggestResumeRoles("ceiling-fixture", input(profile)), /Site.*capacity/i);
    assert.equal(called, false);
    assert.equal((await runtime.api.getStudentSetup("ceiling-fixture")).ready, false);
  } finally { globalThis.fetch = originalFetch; await runtime.close(); }
});
