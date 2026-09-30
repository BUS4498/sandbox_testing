import { discoveryPrompt, realAssessmentPrompt } from "./prompt";
import { HostedOpenAIError, runDiscovery, runPrivateAssessment } from "./openai";
import { appendEvent, canonicalUrl, findDuplicate, getStudentSetup, listOpportunities, finishRun, saveOpportunity, startRun, updateRun, type OpportunityRecord, type RunRecord, type StudentSetup } from "./store";
import { isEvidenceBackedApplicationUrl, isMultiOpportunityIndexUrl } from "./source-links.js";
import { scoreSavedOpportunity } from "./jev";

export type Selection = Awaited<ReturnType<typeof runDiscovery>>["result"]["selectedOpportunities"][number];
export type RunSummary = { searchesPerformed: number; candidatesDiscovered: number; duplicatesOrInvalid: number; candidatesRanked: number; updatesSelected: number; added: number; updated: number; duplicatesIgnored: number; needsAttention: number; notificationsSent: number; scoresAdded: number; scoresUnavailable: number; unresolvedIssues: string[]; selectionShortfallReason: string; selected: Array<{ opportunityId: string | null; company: string; roleTitle: string; outcome: string }> };

export function materialFields(record: OpportunityRecord): Record<string, unknown> {
  return {
    company: record.company, roleTitle: record.roleTitle, location: record.location,
    workArrangement: record.workArrangement, internshipPeriod: record.internshipPeriod,
    deadline: record.deadline, postingStatus: record.postingStatus,
    responsibilities: record.responsibilities ?? [], requiredQualifications: record.requiredQualifications ?? [], preferredQualifications: record.preferredQualifications ?? [],
    applicationUrl: record.applicationUrl, agentDecision: record.agentDecision,
    fitAssessment: record.fitAssessment,
    assessmentProfileMode: record.assessmentProfileMode ?? "SYNTHETIC_DEMONSTRATION",
    assessmentProfileConfirmedAt: record.assessmentProfileConfirmedAt ?? null,
    requiredMatches: [...record.fitEvidence.requiredMatches].sort(),
    gaps: [...record.fitEvidence.gaps].sort(),
  };
}

export function toRecord(selection: Selection, existing: OpportunityRecord | null, now: string, setup: StudentSetup): OpportunityRecord {
  const posting = selection.opportunity;
  return {
    opportunityId: existing?.opportunityId ?? crypto.randomUUID(),
    recordVersion: existing ? existing.recordVersion + 1 : 1,
    dateAdded: existing?.dateAdded ?? now,
    dateDiscovered: existing?.dateDiscovered ?? (posting.dateDiscovered || now.slice(0, 10)),
    lastUpdated: now, lastVerified: posting.lastVerified || now.slice(0, 10), lastAgentReview: now,
    company: posting.company, roleTitle: posting.roleTitle, location: posting.location,
    workArrangement: posting.workArrangement, internshipPeriod: posting.internshipPeriod,
    deadline: posting.deadline, source: posting.source, postingUrl: posting.postingUrl,
    applicationUrl: posting.applicationUrl, employerPostingId: posting.employerPostingId,
    postingStatus: posting.postingStatus, fitAssessment: selection.fitAssessment,
    responsibilities: posting.responsibilities, requiredQualifications: posting.requiredQualifications, preferredQualifications: posting.preferredQualifications,
    fitScore: existing?.fitScore ? { ...existing.fitScore, status: "STALE", reason: "The opportunity or fit evidence changed; a new score is needed." } : undefined,
    fitEvidence: selection.fitEvidence, agentDecision: selection.agentDecision,
    decisionRationale: selection.decisionRationale, selectionEvidence: selection.selectionEvidence,
    nextAction: selection.nextAction, nextActionRequest: selection.nextActionRequest,
    nextActionDate: selection.nextActionDate, unresolvedIssue: selection.unresolvedIssue,
    attentionRequired: selection.attentionRequired,
    applicationStatus: existing?.applicationStatus ?? "NOT_STARTED",
    studentNotes: existing?.studentNotes ?? "",
    assessmentProfileMode: setup.mode === "REAL" ? "REAL" : "SYNTHETIC_DEMONSTRATION",
    assessmentProfileConfirmedAt: setup.confirmedAt,
  };
}

async function stage(ownerId: string, run: RunRecord, value: string, detail: string, progress: number): Promise<void> {
  run.stage = value; run.detail = detail; run.progress = progress;
  await updateRun(ownerId, run);
}

export async function collectOpportunities(ownerId: string): Promise<RunRecord> {
  const run = await startRun(ownerId);
  const summary: RunSummary = { searchesPerformed: 0, candidatesDiscovered: 0, duplicatesOrInvalid: 0, candidatesRanked: 0, updatesSelected: 0, added: 0, updated: 0, duplicatesIgnored: 0, needsAttention: 0, notificationsSent: 0, scoresAdded: 0, scoresUnavailable: 0, unresolvedIssues: [], selectionShortfallReason: "", selected: [] };
  try {
    const setup = await getStudentSetup(ownerId);
    if (!setup.ready) throw new Error("Student setup is incomplete; confirm it before collecting.");
    const known = await listOpportunities(ownerId);
    await appendEvent(ownerId, run.id, null, "RETRIEVE", { knownOpportunityCount: known.length, profileMode: setup.mode, profileConfirmedAt: setup.confirmedAt });
    await stage(ownerId, run, "SENSE", "Searching approved public sources for internships matching the selected roles, location, and timing, with at most ten web searches.", 25);
    const discovery = await runDiscovery(discoveryPrompt(known, new Date().toISOString().slice(0, 10), setup));
    let { result } = discovery;
    const { evidenceUrls } = discovery;
    summary.searchesPerformed = discovery.observedSearches;
    summary.candidatesDiscovered = result.runSummary.candidatesDiscovered;
    summary.duplicatesOrInvalid = result.runSummary.duplicatesOrInvalid;
    summary.candidatesRanked = result.runSummary.candidatesRanked;
    summary.updatesSelected = result.selectedOpportunities.length;
    summary.selectionShortfallReason = result.runSummary.selectionShortfallReason;
    if (setup.mode === "REAL" && result.selectedOpportunities.length > 0) {
      await stage(ownerId, run, "REASON", `Assessing ${result.selectedOpportunities.length} source-checked opportunities against the confirmed profile, with web access disabled.`, 49);
      result = await runPrivateAssessment(realAssessmentPrompt(result, setup, new Date().toISOString().slice(0, 10)), result, discovery.observedSearches);
    }
    summary.unresolvedIssues.push(...result.unresolvedIssues);
    await appendEvent(ownerId, run.id, null, "SENSE", { searchesPerformed: summary.searchesPerformed, candidatesDiscovered: summary.candidatesDiscovered, candidatesRanked: summary.candidatesRanked, selected: summary.updatesSelected, sourceCount: evidenceUrls.length });
    await stage(ownerId, run, "REASON_DECIDE", `Reviewing ${result.selectedOpportunities.length} selected opportunities against source evidence and existing records.`, 58);
    const knownById = new Map(known.map((record) => [record.opportunityId, record]));
    const seenInRun = new Set<string>();
    for (const selection of result.selectedOpportunities) {
      const label = `${selection.opportunity.company} — ${selection.opportunity.roleTitle}`;
      let sourceUrl: string;
      try { sourceUrl = canonicalUrl(selection.opportunity.postingUrl); }
      catch { summary.unresolvedIssues.push(`${label}: posting URL could not be validated.`); summary.needsAttention++; continue; }
      if (isMultiOpportunityIndexUrl(sourceUrl)) {
        summary.duplicatesOrInvalid++;
        summary.needsAttention++;
        summary.unresolvedIssues.push(`${label}: the supplied URL is a multi-role discovery list, not this role's posting. Find and inspect its individual posting before adding it.`);
        summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "POSTING_NOT_VERIFIED" });
        await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Distinct opportunity posting", observed: "Multi-role discovery list URL", outcome: "FAILURE", sourceUrl });
        continue;
      }
      if (seenInRun.has(sourceUrl)) { summary.duplicatesIgnored++; summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "DUPLICATE_IN_RUN" }); continue; }
      seenInRun.add(sourceUrl);
      if (!evidenceUrls.includes(sourceUrl)) {
        summary.unresolvedIssues.push(`${label}: the selected posting URL was not present in returned web-source evidence; no record was changed.`);
        summary.needsAttention++;
        summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "SOURCE_UNVERIFIED" });
        await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Source-backed posting", observed: "Selected URL missing from returned source references", outcome: "FAILURE", postingUrl: sourceUrl });
        continue;
      }
      if (selection.opportunity.postingStatus === "CLOSED" && selection.updateDisposition === "NEW") {
        summary.duplicatesOrInvalid++;
        continue;
      }
      if (selection.opportunity.postingStatus === "UNCERTAIN" && selection.updateDisposition === "NEW") {
        summary.duplicatesOrInvalid++;
        summary.unresolvedIssues.push(`${label}: the current employer posting could not be verified, so this lead was not added. The agent may recheck it in a later bounded run.`);
        summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "SOURCE_CHECK_PENDING" });
        await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Verified current posting before adding a new row", observed: "Posting status uncertain", outcome: "PARTIAL SUCCESS", postingUrl: sourceUrl });
        continue;
      }
      const duplicate = await findDuplicate(ownerId, selection.opportunity);
      let existing = selection.existingOpportunityId ? knownById.get(selection.existingOpportunityId) ?? null : duplicate.record;
      if (selection.updateDisposition === "MATERIALLY_CHANGED" && !existing) {
        summary.unresolvedIssues.push(`${label}: the referenced existing opportunity was not found; no new row was created.`);
        summary.needsAttention++;
        continue;
      }
      if (duplicate.classification === "POSSIBLE" && !selection.existingOpportunityId) {
        summary.unresolvedIssues.push(`${label}: possible duplicate requires review before a row can be added.`);
        summary.needsAttention++;
        continue;
      }
      if (duplicate.classification === "EXACT" && selection.existingOpportunityId && duplicate.record?.opportunityId !== selection.existingOpportunityId) {
        summary.unresolvedIssues.push(`${label}: conflicting opportunity identifiers require review.`);
        summary.needsAttention++;
        continue;
      }
      existing ??= duplicate.record;
      const record = toRecord(selection, existing, new Date().toISOString(), setup);
      if (record.applicationUrl && !isEvidenceBackedApplicationUrl(canonicalUrl(record.applicationUrl), sourceUrl, evidenceUrls)) {
        record.applicationUrl = "";
        record.unresolvedIssue = [record.unresolvedIssue, "Direct application link was not confirmed by returned source evidence."].filter(Boolean).join(" ");
        record.attentionRequired = true;
        summary.unresolvedIssues.push(`${label}: a proposed application link had no matching source reference, so it was not saved. Check the employer career site.`);
      }
      if (existing && JSON.stringify(materialFields(existing)) === JSON.stringify(materialFields(record))) {
        summary.duplicatesIgnored++;
        summary.selected.push({ opportunityId: existing.opportunityId, company: record.company, roleTitle: record.roleTitle, outcome: "UNCHANGED_IGNORED" });
        await appendEvent(ownerId, run.id, existing.opportunityId, "EVALUATION", { expected: "Avoid repeated update", observed: "Known opportunity has no material change", outcome: "SUCCESS" });
        continue;
      }
      await stage(ownerId, run, "ACT", `${existing ? "Updating" : "Adding"} ${label} in the private collection, then reading it back.`, 68);
      try {
        await saveOpportunity(ownerId, record, existing?.recordVersion ?? null);
        if (existing) summary.updated++; else summary.added++;
        summary.selected.push({ opportunityId: record.opportunityId, company: record.company, roleTitle: record.roleTitle, outcome: existing ? "UPDATED" : "ADDED" });
        await appendEvent(ownerId, run.id, record.opportunityId, "DECISION", { decision: record.agentDecision, rationale: record.decisionRationale, evidence: record.fitEvidence });
        await appendEvent(ownerId, run.id, record.opportunityId, "ACTION", { action: existing ? "COLLECTION_ROW_UPDATED" : "COLLECTION_ROW_ADDED", recordVersion: record.recordVersion, result: "SUCCESS" });
        await appendEvent(ownerId, run.id, record.opportunityId, "OBSERVATION", { postingUrl: sourceUrl, postingStatus: record.postingStatus, sourceReferencedInResponse: true, applicationLinkReferencedInResponse: Boolean(record.applicationUrl) });
        await appendEvent(ownerId, run.id, record.opportunityId, "EVALUATION", { expected: "One current opportunity row", observed: "D1 read-back matched the intended record", outcome: "SUCCESS", notification: "NOT_AVAILABLE_IN_PILOT" });
        await stage(ownerId, run, "REASON", `Checking whether ${label} has enough verified evidence for a preliminary Jev fit score.`, 78);
        try {
          const score = await scoreSavedOpportunity(ownerId, record.opportunityId, setup, run.id);
          if (score.status === "SCORED" && score.called) summary.scoresAdded++;
          else summary.scoresUnavailable++;
        } catch {
          summary.scoresUnavailable++;
          await appendEvent(ownerId, run.id, record.opportunityId, "EVALUATION", { expected: "Optional preliminary fit score", observed: "Scoring could not be verified", outcome: "PARTIAL SUCCESS" });
        }
      } catch {
        summary.unresolvedIssues.push(`${label}: the private collection write or read-back failed; no successful update is claimed.`);
        summary.needsAttention++;
        summary.selected.push({ opportunityId: existing?.opportunityId ?? null, company: record.company, roleTitle: record.roleTitle, outcome: "WRITE_UNVERIFIED" });
        await appendEvent(ownerId, run.id, existing?.opportunityId ?? null, "EVALUATION", { expected: "Verified collection update", observed: "Write or read-back failed", outcome: "FAILURE" });
      }
    }
    await stage(ownerId, run, "VERIFY", `Checked ${summary.added + summary.updated} collection writes and recorded duplicate or source issues.`, 90);
    const recorded = await listOpportunities(ownerId);
    await appendEvent(ownerId, run.id, null, "REMEMBER", { collectionCount: recorded.length, added: summary.added, updated: summary.updated, unresolvedIssueCount: summary.unresolvedIssues.length });
    run.status = summary.unresolvedIssues.length ? "PARTIAL_SUCCESS" : "SUCCESS";
    run.stage = "FINISHED";
    run.detail = `${summary.added} added, ${summary.updated} updated, ${summary.duplicatesIgnored} unchanged duplicates ignored. ${summary.scoresAdded} preliminary scores saved; ${summary.scoresUnavailable} unavailable. Email is not available in this pilot.`;
    run.progress = 100; run.finishedAt = new Date().toISOString(); run.summary = summary;
    await finishRun(ownerId, run);
    return run;
  } catch (error) {
    run.status = "FAILURE"; run.stage = "ACTION_REQUIRED"; run.progress = 100;
    run.detail = error instanceof HostedOpenAIError ? error.message : "The collection run could not be completed. No unverified result is presented as successful.";
    run.errorCode = error instanceof HostedOpenAIError ? error.code : "COLLECTION_FAILURE";
    run.finishedAt = new Date().toISOString(); run.summary = summary;
    try { await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Complete bounded discovery", observed: run.errorCode, outcome: "FAILURE" }); } catch { /* Preserve original failure. */ }
    await finishRun(ownerId, run);
    return run;
  }
}
