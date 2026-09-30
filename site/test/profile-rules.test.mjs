import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ROLE_CHOICES, normalizeRealSetup, publicSearchProjection } from "../lib/hosted/profile-rules.js";

const valid = {
  profileText: "Junior Information Systems student with SQL, Excel, and Power BI project experience in process analysis.",
  confirmedNoIdentifiers: true,
  apiAssessmentConsent: true,
  roles: [DEFAULT_ROLE_CHOICES[0]],
  customRole: "",
  availableFrom: "2027-05-24",
  availableThrough: "2027-08-20",
  hoursPerWeek: 40,
  paidPreference: "PREFERRED",
  relocationFlexibility: "NO",
  workAuthorization: "UNSURE_OR_PREFER_NOT_TO_STATE",
  workArrangements: ["HYBRID", "REMOTE"],
  geographicBoundaries: "California",
  additionalConstraints: "",
};

test("valid setup returns only reviewed profile and structured preferences", () => {
  const result = normalizeRealSetup(valid);
  assert.equal(result.preferences.roles[0], DEFAULT_ROLE_CHOICES[0]);
  assert.equal(result.preferences.geographicBoundaries, "California");
  assert.equal(result.profileText, valid.profileText);
});
test("direct identifiers are blocked", () => {
  assert.throws(() => normalizeRealSetup({ ...valid, profileText: `${valid.profileText} Email morgan@example.com` }), /email address/);
});
test("unreviewed profiles are blocked", () => {
  assert.throws(() => normalizeRealSetup({ ...valid, confirmedNoIdentifiers: false }), /Review the profile/);
});
test("required preferences cannot be omitted", () => {
  assert.throws(() => normalizeRealSetup({ ...valid, roles: [] }), /preferred role/);
  assert.throws(() => normalizeRealSetup({ ...valid, availableThrough: "2027-01-01" }), /Availability end/);
  assert.throws(() => normalizeRealSetup({ ...valid, workArrangements: [] }), /work arrangement/);
});
test("custom role can be the only intentional role and personal details are blocked in constraints", () => {
  assert.deepEqual(normalizeRealSetup({ ...valid, roles: [], customRole: "Operations Analyst Intern" }).preferences.roles, ["Operations Analyst Intern"]);
  assert.throws(() => normalizeRealSetup({ ...valid, additionalConstraints: "Contact me at morgan@example.com" }), /email address/);
});
test("several custom roles are retained in order and duplicate roles are rejected", () => {
  const customRoles = ["Healthcare AI Analyst Intern", "Supply Chain Data Intern"];
  assert.deepEqual(normalizeRealSetup({ ...valid, customRoles }).preferences.roles, [DEFAULT_ROLE_CHOICES[0], ...customRoles]);
  assert.throws(() => normalizeRealSetup({ ...valid, customRoles: ["AI business analyst intern"] }), /distinct/);
  assert.throws(() => normalizeRealSetup({ ...valid, customRoles: ["Product Intern", "product intern"] }), /distinct/);
});
test("custom role count and direct identifiers are bounded", () => {
  assert.throws(() => normalizeRealSetup({ ...valid, customRoles: Array.from({ length: 9 }, (_, i) => `Role ${i}`) }), /no more than eight/);
  assert.throws(() => normalizeRealSetup({ ...valid, customRoles: ["morgan@example.com"] }), /email address/);
});
test("public search projection excludes resume, legal eligibility, and free-form constraints", () => {
  const normalized = normalizeRealSetup(valid);
  const projection = publicSearchProjection({ ...normalized.preferences, profileText: normalized.profileText, privateLegalNote: "private" });
  assert.equal(projection.broadGeography, "California");
  assert.equal(JSON.stringify(projection).includes("Information Systems student"), false);
  assert.equal(JSON.stringify(projection).includes("workAuthorization"), false);
  assert.equal(JSON.stringify(projection).includes("additionalConstraints"), false);
});
