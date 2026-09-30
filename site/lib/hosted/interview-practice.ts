import { env } from "cloudflare:workers";
import { appendEvent, finishRun, getOpportunity, startRun, updateRun, type RunRecord } from "./store";
import { runInterviewResearch, type InterviewPracticeResult } from "./openai";
import { saveInterviewWordMaterial } from "./materials-store";
import { interviewWordPlan } from "./interview-word-plan.js";
import { publicPostingFacts } from "./posting-prep-facts.js";

export type SavedInterviewPractice = InterviewPracticeResult & {
  opportunityId: string; opportunityVersion: number; materialId: string; preparedAt: string;
};

function database(): D1Database {
  if (!env.DB) throw new Error("Private interview-practice storage is unavailable.");
  return env.DB;
}

export async function listInterviewPractice(ownerId: string): Promise<SavedInterviewPractice[]> {
  const rows = await database().prepare("SELECT opportunity_id,payload_json FROM operational_events WHERE owner_id=? AND kind='INTERVIEW_PRACTICE_RESULT' ORDER BY created_at DESC LIMIT 150")
    .bind(ownerId).all<{ opportunity_id: string; payload_json: string }>();
  const seen = new Set<string>();
  const output: SavedInterviewPractice[] = [];
  for (const row of rows.results) {
    if (seen.has(row.opportunity_id)) continue;
    try {
      const result = JSON.parse(row.payload_json) as SavedInterviewPractice;
      if (result.opportunityId !== row.opportunity_id || !Array.isArray(result.reportedQuestions) || !Array.isArray(result.likelyQuestions)) continue;
      seen.add(row.opportunity_id); output.push(result);
    } catch { /* Ignore malformed historical event; do not expose raw payload. */ }
  }
  return output;
}

export async function prepareInterviewPractice(ownerId: string, opportunityId: string, requestId: string): Promise<RunRecord> {
  const record = await getOpportunity(ownerId, opportunityId);
  if (!record) throw new TypeError("This opportunity is no longer in your collection.");
  const run = await startRun(ownerId, "INTERVIEW_PRACTICE");
  let savedMaterialId = "";
  try {
    await appendEvent(ownerId, run.id, opportunityId, "RETRIEVE", { action: "INTERVIEW_PRACTICE", opportunityVersion: record.recordVersion });
    run.stage = "SEARCH"; run.progress = 25;
    run.detail = `Searching separately for reported interview questions and interview-process details for ${record.company} — ${record.roleTitle}. No student profile is sent in search queries.`;
    await updateRun(ownerId, run);
    const result = await runInterviewResearch(publicPostingFacts(record));
    run.stage = "VERIFY"; run.progress = 70;
    run.detail = `Checking question and process sources and preparing a separate Word practice set for ${record.company}.`;
    await updateRun(ownerId, run);
    const latest = await getOpportunity(ownerId, opportunityId);
    if (!latest || latest.recordVersion !== record.recordVersion) throw new Error("The opportunity changed during interview research. Refresh it and try again.");
    const material = await saveInterviewWordMaterial(ownerId, record, requestId, interviewWordPlan(record, result));
    savedMaterialId = material.materialId;
    const saved: SavedInterviewPractice = { ...result, opportunityId, opportunityVersion: record.recordVersion, materialId: material.materialId, preparedAt: new Date().toISOString() };
    await appendEvent(ownerId, run.id, opportunityId, "INTERVIEW_PRACTICE_RESULT", saved);
    const visible = (await listInterviewPractice(ownerId)).find((item) => item.opportunityId === opportunityId);
    if (!visible || visible.materialId !== material.materialId) throw new Error("The saved interview-practice result failed read-back verification.");
    await appendEvent(ownerId, run.id, opportunityId, "EVALUATION", { outcome: "SUCCESS", reportedCount: result.reportedQuestions.length, processCount: result.reportedProcess.length, likelyCount: result.likelyQuestions.length, materialId: material.materialId, searchesPerformed: result.searchesPerformed });
    run.status = "SUCCESS"; run.stage = "FINISHED"; run.progress = 100;
    run.detail = `${result.reportedQuestions.length} reported question${result.reportedQuestions.length === 1 ? "" : "s"}, ${result.reportedProcess.length} verified process detail${result.reportedProcess.length === 1 ? "" : "s"}, and ${result.likelyQuestions.length} likely practice question${result.likelyQuestions.length === 1 ? "" : "s"} saved for ${record.company}. Nothing was submitted or sent.`;
    run.summary = { runKind: "INTERVIEW_PRACTICE", opportunityId, reported: result.reportedQuestions.length, process: result.reportedProcess.length, likely: result.likelyQuestions.length, searchesPerformed: result.searchesPerformed, sourcesInspected: result.sourcesInspected, materialId: material.materialId, emailSent: false };
  } catch (error) {
    run.status = savedMaterialId ? "PARTIAL_SUCCESS" : "FAILURE"; run.stage = "ACTION_REQUIRED"; run.progress = 100;
    run.detail = savedMaterialId ? "The Word file was stored but the practice result could not be fully verified. Retry after checking the opportunity." : error instanceof Error && error.message.includes("changed during") ? error.message : "Interview-practice research or saving could not be verified. No success is claimed; try again later.";
    run.summary = { runKind: "INTERVIEW_PRACTICE", opportunityId, materialId: savedMaterialId || null, searchesPerformed: 0, emailSent: false, unresolvedIssues: [run.detail] };
    await appendEvent(ownerId, run.id, opportunityId, "EVALUATION", { outcome: run.status, issue: run.detail }).catch(() => undefined);
  }
  run.finishedAt = new Date().toISOString();
  await finishRun(ownerId, run);
  return run;
}
