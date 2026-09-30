import test from "node:test";
import assert from "node:assert/strict";
import { prepareLetterForReview, UNVERIFIED_LABEL, validateLetterParagraphs } from "../lib/hosted/material-draft-validation.js";

const evidence = [
  { id: "E1", text: "Built a synthetic inventory dashboard for a course project." },
  { id: "E2", text: "Documented workflow requirements during a campus operations job." },
];

const paragraphs = [
  { text: "I am interested in the Operations Intern role and its process-improvement work.", evidenceIds: [] },
  { text: "I built a synthetic inventory dashboard for a course project.", evidenceIds: ["E1"] },
  { text: "My campus operations work included documenting workflow requirements.", evidenceIds: ["E2"] },
  { text: "Thank you for considering my application.", evidenceIds: [] },
];

test("a short factual-free closing does not require a false resume citation", () => {
  const result = validateLetterParagraphs(paragraphs, evidence);
  assert.equal(result.length, 4);
  assert.deepEqual(result.at(-1).evidenceIds, []);
});

test("a separately written thanks is merged without losing text or citations", () => {
  const result = validateLetterParagraphs([
    ...paragraphs.slice(0, 3),
    { text: "I would welcome the opportunity to discuss the role further.", evidenceIds: [] },
    { text: "Thank you for your consideration.", evidenceIds: [] },
  ], evidence);
  assert.equal(result.length, 4);
  assert.match(result.at(-1).text, /discuss the role further\. Thank you/);
});

test("uncited factual student claims remain blocked", () => {
  assert.throws(() => validateLetterParagraphs([
    paragraphs[0],
    { text: "I built a production analytics platform for a national company.", evidenceIds: [] },
    paragraphs[2], paragraphs[3],
  ], evidence), /needs verified resume evidence/);
});

test("substantive body paragraphs require evidence even without first-person wording", () => {
  assert.throws(() => validateLetterParagraphs([
    paragraphs[0],
    { text: "The candidate built a production analytics platform for a national company.", evidenceIds: [] },
    paragraphs[2], paragraphs[3],
  ], evidence), /needs verified resume evidence/);
});

test("unknown resume evidence IDs remain blocked", () => {
  assert.throws(() => validateLetterParagraphs([
    paragraphs[0],
    { text: "I built a synthetic inventory dashboard for a course project.", evidenceIds: ["E99"] },
    paragraphs[2], paragraphs[3],
  ], evidence), /outside the confirmed resume/);
});

test("an uncited student claim stays in a saved review draft with a visible label and separate note", () => {
  const candidate = [{ text: "I have worked on process-improvement projects and am interested in this role.", evidenceIds: [] }, ...paragraphs.slice(1)];
  const result = prepareLetterForReview(candidate, evidence);
  assert.equal(result.paragraphs.length, 4);
  assert.ok(result.paragraphs[0].text.startsWith(UNVERIFIED_LABEL));
  assert.match(result.paragraphs[0].text, /I have worked on process-improvement projects/);
  assert.equal(result.verificationNotes.length, 1);
  assert.match(result.verificationNotes[0], /Confirm or remove this proposed wording/);
  assert.deepEqual(result.paragraphs[1].evidenceIds, ["E1"]);
});

test("unsupported numeric claims are replaced in a saved review draft, not asserted as facts", () => {
  const result = prepareLetterForReview([
    { text: "I have managed 15 enterprise AI systems and want this role.", evidenceIds: [] }, ...paragraphs.slice(1),
  ], evidence);
  assert.match(result.paragraphs[0].text, /^UNVERIFIED/);
  assert.match(result.paragraphs[0].text, /\[figure to verify\]/);
  assert.doesNotMatch(result.paragraphs[0].text, /15 enterprise/);
  assert.match(result.verificationNotes[0], /15 enterprise AI systems/);
});

test("a number omitted from cited evidence is qualified even when the paragraph has an evidence ID", () => {
  const result = prepareLetterForReview([
    paragraphs[0],
    { text: "I built 15 synthetic inventory dashboards for a course project.", evidenceIds: ["E1"] },
    ...paragraphs.slice(2),
  ], evidence);
  assert.match(result.paragraphs[1].text, /^UNVERIFIED/);
  assert.match(result.paragraphs[1].text, /\[figure to verify\]/);
  assert.equal(result.verificationNotes.length, 1);
});

test("internal evidence IDs do not appear as parenthetical cover-letter citations", () => {
  const result = prepareLetterForReview([
    paragraphs[0],
    { text: "I built a synthetic inventory dashboard for a course project (E1).", evidenceIds: ["E1"] },
    { text: "My campus operations work included documenting workflow requirements (E1, E2).", evidenceIds: ["E2"] },
    paragraphs[3],
  ], evidence);
  assert.doesNotMatch(result.paragraphs.map((item) => item.text).join(" "), /\(E\d+/);
  assert.deepEqual(result.paragraphs[1].evidenceIds, ["E1"]);
});

test("verified internship-period years remain readable while unsupported student metrics are flagged", () => {
  const result = prepareLetterForReview([
    { text: "I am interested in this internship for Fall 2026/Winter 2027 and have managed 15 products.", evidenceIds: [] },
    ...paragraphs.slice(1),
  ], evidence, "Hardware Product Management Intern - Fall 2026/Winter 2027");
  assert.match(result.paragraphs[0].text, /Fall 2026\/Winter 2027/);
  assert.match(result.paragraphs[0].text, /managed \[figure to verify\] products/);
  assert.doesNotMatch(result.paragraphs[0].text, /managed 15 products/);
});

test("a short model paragraph is saved as a visibly marked review draft", () => {
  const result = prepareLetterForReview([
    paragraphs[0], paragraphs[1],
    { text: "This work fits the role.", evidenceIds: ["E2"] },
    paragraphs[3],
  ], evidence);
  assert.match(result.paragraphs[2].text, /^UNVERIFIED/);
  assert.match(result.verificationNotes[0], /too short or long/);
  assert.throws(() => validateLetterParagraphs([
    paragraphs[0], paragraphs[1],
    { text: "This work fits the role.", evidenceIds: ["E2"] },
    paragraphs[3],
  ], evidence), /complete, concise/);
});

test("a letter without evidence-backed body remains blocked", () => {
  assert.throws(() => prepareLetterForReview([
    paragraphs[0],
    { text: "I have broad technology experience and can improve the team's workflow.", evidenceIds: [] },
    { text: "My systems background will support the team's reporting and analytics.", evidenceIds: [] },
    paragraphs[3],
  ], evidence), /at least one evidence-backed body paragraph/);
});
