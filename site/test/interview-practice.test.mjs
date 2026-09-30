import assert from "node:assert/strict";
import test from "node:test";
import { safeInterviewSource, validateInterviewPractice, verifyReportedQuestions } from "../lib/hosted/interview-practice-contract.js";
import { interviewWordPlan } from "../lib/hosted/interview-word-plan.js";
import { createWordDraft, verifyWordDraft } from "../lib/hosted/word-drafts.js";
import { unzipSync } from "fflate";

const url = "https://www.reddit.com/r/careers/comments/example/interview/";
const raw = {
  reportedQuestions: [{ question: "Tell me about a process improvement.", sourceUrl: url, sourceName: "Candidate account", sourceDate: "2026-01-01", roleMatch: "EXACT_ROLE", evidenceQuote: "They asked me about a process improvement." }],
  reportedProcess: [{ description: "A recruiter screening call came first.", sourceUrl: url, sourceName: "Candidate account", sourceDate: "2026-01-01", roleMatch: "EXACT_ROLE", sourceKind: "CANDIDATE_REPORT", evidenceQuote: "The recruiter screening call came first." }],
  likelyQuestions: ["What would you do with messy data?"], generalProcessGuidance: ["Ask the recruiter to confirm the actual stages."], searchNotes: "One candidate account was found.",
};

test("public source validation rejects local, insecure, and unrelated URLs", () => {
  assert.equal(safeInterviewSource("http://www.reddit.com/post"), null);
  assert.equal(safeInterviewSource("https://127.0.0.1/post"), null);
  assert.equal(safeInterviewSource("https://reddit.com.evil.test/post"), null);
  assert.equal(safeInterviewSource(url), url.slice(0, -1));
});

test("unreferenced reported questions are omitted but likely practice survives", () => {
  const result = validateInterviewPractice(raw, []);
  assert.equal(result.reportedQuestions.length, 0);
  assert.deepEqual(result.likelyQuestions, ["What would you do with messy data?"]);
});

test("reported questions require accessible exact page evidence and employer reference", async () => {
  const parsed = validateInterviewPractice(raw, [url]);
  const okPage = async () => new Response("<html>At Acme, they asked me about a process improvement. The recruiter screening call came first.</html>", { headers: { "content-type": "text/html" } });
  const verified = await verifyReportedQuestions(parsed, okPage, "Acme", "AI Business Analyst Intern");
  assert.equal(verified.reportedQuestions.length, 1);
  assert.equal(verified.reportedProcess.length, 1);
  assert.equal(verified.sourcesInspected, 1);
  assert.equal(verified.reportedQuestions[0].roleMatch, "RELATED_ROLE");
  const missing = await verifyReportedQuestions(parsed, async () => new Response("<html>Generic preparation advice.</html>", { headers: { "content-type": "text/html" } }), "Acme", "AI Business Analyst Intern");
  assert.equal(missing.reportedQuestions.length, 0);
  assert.equal(missing.reportedProcess.length, 0);
  assert.match(missing.searchNotes, /could not be verified/);
});

test("inaccessible pages never become reported questions", async () => {
  const parsed = validateInterviewPractice(raw, [url]);
  const result = await verifyReportedQuestions(parsed, async () => new Response("Login required", { status: 403, headers: { "content-type": "text/html" } }), "Acme");
  assert.equal(result.reportedQuestions.length, 0);
  assert.equal(result.reportedProcess.length, 0);
});

test("process reports cannot claim employer guidance from a candidate site", () => {
  const falseAuthority = { ...raw, reportedProcess: [{ ...raw.reportedProcess[0], sourceKind: "EMPLOYER_GUIDANCE" }] };
  assert.equal(validateInterviewPractice(falseAuthority, [url]).reportedProcess.length, 0);
});

test("Word practice set separates verified reports from generated prompts", () => {
  const record = { company: "Acme", roleTitle: "AI Business Analyst Intern", postingUrl: "https://example.com/role" };
  const plan = interviewWordPlan(record, { reportedQuestions: [{ question: "Describe a process improvement.", roleMatch: "RELATED_ROLE", sourceName: "Candidate account", sourceDate: "2026-01-01", sourceUrl: url }], reportedProcess: [{ description: "Recruiter screen came first.", roleMatch: "RELATED_ROLE", sourceKind: "CANDIDATE_REPORT", sourceName: "Candidate account", sourceDate: "2026-01-01", sourceUrl: url }], likelyQuestions: ["How would you test an AI workflow?"], generalProcessGuidance: ["Ask the recruiter to confirm the stages."], searchNotes: "Question search: one source checked.\nProcess search: one source checked." });
  const bytes = createWordDraft(plan);
  assert.ok(verifyWordDraft(bytes, plan.title));
  const xml = new TextDecoder().decode(unzipSync(bytes)["word/document.xml"]);
  assert.match(xml, /Publicly reported questions/);
  assert.match(xml, /Publicly reported interview process/);
  assert.match(xml, /Likely questions to practice/);
  assert.match(xml, /General process preparation/);
  assert.match(xml, /Generated practice question; not reported by a candidate/);
  assert.match(xml, /DRAFT TEMPLATE/);
  assert.match(xml, /Question search: one source checked/);
  assert.match(xml, /Process search: one source checked/);
  assert.doesNotMatch(xml, /Student review checklist/);
  assert.doesNotMatch(xml, /Posting: https:\/\//);
});
