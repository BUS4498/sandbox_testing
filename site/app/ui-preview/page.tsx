import { notFound } from "next/navigation";
import DeskClient, { type Status } from "@/app/desk-client";
import type { OpportunityRecord, RunRecord } from "@/lib/hosted/store";

export const dynamic = "force-dynamic";

const TODAY = "2026-09-29T16:00:00.000Z";

function sampleOpportunity(values: Partial<OpportunityRecord> & Pick<OpportunityRecord, "opportunityId" | "company" | "roleTitle" | "agentDecision" | "decisionRationale" | "nextAction">): OpportunityRecord {
  return {
    recordVersion: 1, dateAdded: TODAY, dateDiscovered: TODAY, lastUpdated: TODAY, lastVerified: TODAY, lastAgentReview: TODAY,
    location: "California", workArrangement: "Hybrid", internshipPeriod: "Summer 2027", deadline: "Unknown", source: "Synthetic visual preview",
    postingUrl: "https://example.org/preview-posting", applicationUrl: "https://example.org/preview-apply", employerPostingId: "preview", postingStatus: "ACTIVE",
    responsibilities: ["Analyze an example business workflow", "Summarize findings for a project team"],
    requiredQualifications: ["Current undergraduate enrollment", "Interest in business systems"], preferredQualifications: ["SQL or spreadsheet analysis"],
    fitAssessment: "Illustrative assessment for interface review only.",
    fitEvidence: { requiredMatches: ["Information Systems coursework supports business-systems analysis."], preferredMatches: ["A class project used SQL and spreadsheet reporting."], gaps: ["The available example does not confirm prior work with the employer's platform."], unknowns: [], preferenceAlignment: [] },
    selectionEvidence: ["Synthetic visual preview only"], nextActionRequest: { prompt: "Can you attend a hybrid internship in the stated California location?", responseType: "INFORMATION", options: [], whatHappensNext: "Your answer will be reviewed for this opportunity only." },
    nextActionDate: "", unresolvedIssue: "Hybrid attendance needs confirmation.", attentionRequired: true, applicationStatus: "NOT_STARTED", studentNotes: "", assessmentProfileMode: "SYNTHETIC_DEMONSTRATION",
    ...values,
  };
}

const sampleRecords: OpportunityRecord[] = [
  sampleOpportunity({ opportunityId: "preview-northstar", company: "Northstar Software", roleTitle: "AI Business Analyst Intern", location: "San Luis Obispo, CA", agentDecision: "PRIORITIZE", decisionRationale: "The example role closely matches the student's systems-analysis coursework and SQL project. The exact team assignment remains unknown.", nextAction: "Confirm hybrid attendance and review the official posting before preparing materials.", fitScore: { status: "SCORED", value: 85, reason: "", model: "illustrative", rubricVersion: "preview", evidenceFingerprint: "preview", scoredAt: TODAY, components: null } }),
  sampleOpportunity({ opportunityId: "preview-harborline", company: "Harborline Health", roleTitle: "Business Systems Intern", location: "Los Angeles, CA", agentDecision: "FOLLOW_UP", decisionRationale: "The example responsibilities align with process mapping and dashboard experience. Four onsite days each week may conflict with the student's schedule.", nextAction: "Confirm whether four office days each week are feasible.", nextActionRequest: { prompt: "Can you work onsite in Los Angeles four days a week during Summer 2027?", responseType: "INFORMATION", options: [], whatHappensNext: "The agent will reassess this opportunity only." }, fitScore: { status: "SCORED", value: 65, reason: "", model: "illustrative", rubricVersion: "preview", evidenceFingerprint: "preview", scoredAt: TODAY, components: null } }),
  sampleOpportunity({ opportunityId: "preview-cedar", company: "Cedar Logistics", roleTitle: "Data Operations Intern", location: "Sacramento, CA", workArrangement: "Remote", agentDecision: "MONITOR", decisionRationale: "The example role offers relevant reporting work, but the posting does not yet confirm its internship dates or application deadline.", nextAction: "Check the internship period before deciding whether to prepare a draft.", nextActionRequest: { prompt: "Is the stated internship period compatible with your Summer 2027 availability?", responseType: "INFORMATION", options: [], whatHappensNext: "The agent will reassess this opportunity only." }, fitScore: { status: "UNAVAILABLE", value: null, reason: "The example posting lacks enough timing evidence.", model: "illustrative", rubricVersion: "preview", evidenceFingerprint: "preview", scoredAt: null, components: null } }),
];

function sampleRun(state: string): RunRecord | null {
  if (state === "empty" || state === "setup") return null;
  return { id: `preview-${state}`, kind: "COLLECTION", status: state === "running" ? "IN_PROGRESS" : state === "failure" ? "FAILURE" : "SUCCESS",
    stage: state === "running" ? "SEARCHING_THE_WEB" : state === "failure" ? "VERIFY" : "FINISHED",
    detail: state === "running" ? "Illustrative search state: checking public postings for relevant California analyst internships." : state === "failure" ? "Illustrative failure state: a posting could not be verified. No data was saved." : "Illustrative completed-run view. No data was saved or sent.",
    progress: state === "running" ? 42 : 100, startedAt: state === "running" ? new Date(Date.now() - 12_000).toISOString() : TODAY, finishedAt: state === "running" ? null : "2026-09-29T16:00:28.000Z",
    summary: { searchesPerformed: 2, candidatesDiscovered: 6, duplicatesOrInvalid: 2, candidatesRanked: 4, updatesSelected: 2, added: 2, updated: 0, scoresAdded: 0, notificationsSent: 0, selected: [] }, errorCode: state === "failure" ? "SOURCE_UNAVAILABLE" : null };
}

export default async function UiPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const requested = (await searchParams).state;
  const state = requested === "running" || requested === "failure" || requested === "empty" || requested === "setup" ? requested : "ready";
  const status: Status = {
    keyConfigured: false, jevConfigured: false,
    setup: { mode: state === "setup" ? "UNSELECTED" : "SYNTHETIC_DEMONSTRATION", ready: state !== "setup", profileText: "", preferences: null, confirmedAt: null, updatedAt: TODAY },
    run: sampleRun(state), opportunities: state === "empty" || state === "setup" ? [] : sampleRecords,
    studentResponses: [], materials: [], interviewPractice: [], capabilities: { wordDrafts: true, interviewPractice: true, reset: false },
  };
  return <><nav className="preview-nav" aria-label="Visual preview states"><a href="/ui-preview">Ready</a><a href="/ui-preview?state=setup">Setup</a><a href="/ui-preview?state=running">Running</a><a href="/ui-preview?state=failure">Failure</a><a href="/ui-preview?state=empty">Empty</a></nav><DeskClient previewStatus={status} /></>;
}
