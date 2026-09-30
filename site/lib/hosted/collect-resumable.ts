import { env } from "cloudflare:workers";
import { discoveryPrompt, realAssessmentPrompt } from "./prompt";
import { HostedOpenAIError, readBackgroundAssessment, readBackgroundDiscovery, retrieveBackground, startBackgroundAssessment, startBackgroundDiscovery, type ValidatedResult } from "./openai";
import { materialFields, toRecord, type RunSummary, type Selection } from "./collect";
import { appendEvent, canonicalUrl, collectionAllowance, findDuplicate, finishRun, getStudentSetup, latestRun, listOpportunities, saveOpportunity, startRun, updateRun, UsageLimitError, type RunRecord, type StudentSetup } from "./store";
import { isEvidenceBackedApplicationUrl, postingAdmissionIssue } from "./source-links.js";
import { availableJevModel, scoreSavedOpportunity } from "./jev";

type Phase = "DISCOVERY" | "ASSESSMENT_START" | "ASSESSMENT" | "PROCESS";
type CollectionJob = {
  phase: Phase;
  responseId: string | null;
  phaseStartedAt: string;
  profileConfirmedAt: string | null;
  discovery: ValidatedResult | null;
  result: ValidatedResult | null;
  evidenceUrls: string[];
  observedSearches: number;
  index: number;
  processedUrls: string[];
  pollFailures: number;
  summary: RunSummary;
};

function database(): D1Database {
  if (!env.DB) throw new Error("Private collection storage is unavailable.");
  return env.DB;
}

function emptySummary(): RunSummary {
  return { searchesPerformed: 0, candidatesDiscovered: 0, duplicatesOrInvalid: 0, candidatesRanked: 0, updatesSelected: 0, added: 0, updated: 0, duplicatesIgnored: 0, needsAttention: 0, notificationsSent: 0, scoresAdded: 0, scoresUnavailable: 0, unresolvedIssues: [], selectionShortfallReason: "", selected: [] };
}

async function saveJob(ownerId: string, runId: string, job: CollectionJob): Promise<void> {
  const write = await database().prepare("UPDATE runs SET job_json=? WHERE owner_id=? AND id=? AND status='IN_PROGRESS'")
    .bind(JSON.stringify(job), ownerId, runId).run();
  if (!write.meta?.changes) throw new Error("The collection checkpoint could not be saved.");
}

async function loadJob(ownerId: string, runId: string): Promise<CollectionJob | null> {
  const row = await database().prepare("SELECT job_json FROM runs WHERE owner_id=? AND id=?")
    .bind(ownerId, runId).first<{ job_json: string | null }>();
  return row?.job_json ? JSON.parse(row.job_json) as CollectionJob : null;
}

async function clearJob(ownerId: string, runId: string): Promise<void> {
  await database().prepare("UPDATE runs SET job_json=NULL,job_lease_until=NULL,job_lease_token=NULL WHERE owner_id=? AND id=?")
    .bind(ownerId, runId).run();
}

async function lease(ownerId: string, runId: string): Promise<string | null> {
  const now = new Date();
  const token = crypto.randomUUID();
  const result = await database().prepare("UPDATE runs SET job_lease_token=?,job_lease_until=? WHERE owner_id=? AND id=? AND status='IN_PROGRESS' AND (job_lease_until IS NULL OR job_lease_until<?)")
    .bind(token, new Date(now.getTime() + 60_000).toISOString(), ownerId, runId, now.toISOString()).run();
  return result.meta?.changes ? token : null;
}

async function release(ownerId: string, runId: string, token: string): Promise<void> {
  await database().prepare("UPDATE runs SET job_lease_token=NULL,job_lease_until=NULL WHERE owner_id=? AND id=? AND job_lease_token=?")
    .bind(ownerId, runId, token).run();
}

async function stage(ownerId: string, run: RunRecord, stageName: string, detail: string, progress: number, summary?: RunSummary): Promise<void> {
  run.stage = stageName; run.detail = detail; run.progress = progress;
  if (summary) run.summary = summary;
  await updateRun(ownerId, run);
}

async function fail(ownerId: string, run: RunRecord, summary: RunSummary, error: unknown): Promise<RunRecord> {
  run.status = "FAILURE"; run.stage = "ACTION_REQUIRED"; run.progress = 100;
  run.detail = error instanceof HostedOpenAIError ? error.message : error instanceof Error && error.message === "Student setup changed during collection. Start a new run." ? error.message : "The collection run could not be completed. No unverified result is presented as successful.";
  run.errorCode = error instanceof HostedOpenAIError ? error.code : "COLLECTION_FAILURE";
  run.finishedAt = new Date().toISOString(); run.summary = summary;
  try { await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Complete bounded discovery", observed: run.errorCode, outcome: "FAILURE" }); } catch { /* Keep original failure. */ }
  await finishRun(ownerId, run);
  await clearJob(ownerId, run.id);
  return run;
}

export async function startResumableCollection(ownerId: string): Promise<RunRecord> {
  // Reject setup/provider preflight failures before reserving a daily run slot.
  const setup = await getStudentSetup(ownerId);
  if (!setup.ready) throw new TypeError("Student setup is incomplete; confirm it before collecting.");
  const allowance = await collectionAllowance(ownerId);
  if (!allowance.allowed) throw new UsageLimitError(allowance.reason, allowance.retryAt);
  try { await availableJevModel(); }
  catch { throw new HostedOpenAIError("Jev scoring could not be verified. Check the TypeSafe connection before collecting.", "JEV_NOT_READY"); }
  const run = await startRun(ownerId);
  const summary = emptySummary();
  try {
    const known = await listOpportunities(ownerId);
    await appendEvent(ownerId, run.id, null, "RETRIEVE", { knownOpportunityCount: known.length, profileMode: setup.mode, profileConfirmedAt: setup.confirmedAt });
    await stage(ownerId, run, "SENSE", "Starting a bounded public search. A page reload is safe; keep the Site open so it can check and finish each stage.", 20, summary);
    const responseId = await startBackgroundDiscovery(discoveryPrompt(known, new Date().toISOString().slice(0, 10), setup));
    const job: CollectionJob = { phase: "DISCOVERY", responseId, phaseStartedAt: new Date().toISOString(), profileConfirmedAt: setup.confirmedAt, discovery: null, result: null, evidenceUrls: [], observedSearches: 0, index: 0, processedUrls: [], pollFailures: 0, summary };
    await saveJob(ownerId, run.id, job);
    await stage(ownerId, run, "SENSE", "Searching approved public sources and inspecting individual postings. The run will continue as the page checks progress.", 25, summary);
    return run;
  } catch (error) { return fail(ownerId, run, summary, error); }
}

function phaseTimedOut(job: CollectionJob): boolean {
  return Date.now() - Date.parse(job.phaseStartedAt) > 8 * 60_000;
}

async function processSelection(ownerId: string, run: RunRecord, job: CollectionJob, setup: StudentSetup, selection: Selection): Promise<void> {
  const summary = job.summary;
  const label = `${selection.opportunity.company} — ${selection.opportunity.roleTitle}`;
  let sourceUrl: string;
  try { sourceUrl = canonicalUrl(selection.opportunity.postingUrl); }
  catch { summary.unresolvedIssues.push(`${label}: posting URL could not be validated.`); summary.needsAttention++; return; }
  const admissionIssue = postingAdmissionIssue({ ...selection.opportunity, postingUrl: sourceUrl }, job.evidenceUrls, selection.updateDisposition);
  if (admissionIssue) {
    summary.duplicatesOrInvalid++; summary.needsAttention++;
    summary.unresolvedIssues.push(`${label}: ${admissionIssue} No record changed.`);
    summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "POSTING_NOT_ACCEPTED" });
    await appendEvent(ownerId, run.id, null, "EVALUATION", { expected: "Supported role-specific posting", observed: admissionIssue, outcome: "FAILURE", sourceUrl });
    return;
  }
  if (job.processedUrls.includes(sourceUrl)) {
    summary.duplicatesIgnored++;
    summary.selected.push({ opportunityId: null, company: selection.opportunity.company, roleTitle: selection.opportunity.roleTitle, outcome: "DUPLICATE_IN_RUN" });
    return;
  }
  job.processedUrls.push(sourceUrl);
  const known = await listOpportunities(ownerId);
  const knownById = new Map(known.map((record) => [record.opportunityId, record]));
  const duplicate = await findDuplicate(ownerId, selection.opportunity);
  let existing = selection.existingOpportunityId ? knownById.get(selection.existingOpportunityId) ?? null : duplicate.record;
  if (selection.updateDisposition === "MATERIALLY_CHANGED" && !existing) {
    summary.unresolvedIssues.push(`${label}: the referenced existing opportunity was not found; no new row was created.`); summary.needsAttention++; return;
  }
  if (duplicate.classification === "POSSIBLE" && !selection.existingOpportunityId) {
    summary.unresolvedIssues.push(`${label}: possible duplicate requires review before a row can be added.`); summary.needsAttention++; return;
  }
  if (duplicate.classification === "EXACT" && selection.existingOpportunityId && duplicate.record?.opportunityId !== selection.existingOpportunityId) {
    summary.unresolvedIssues.push(`${label}: conflicting opportunity identifiers require review.`); summary.needsAttention++; return;
  }
  existing ??= duplicate.record;
  const record = toRecord(selection, existing, new Date().toISOString(), setup);
  if (record.applicationUrl && !isEvidenceBackedApplicationUrl(canonicalUrl(record.applicationUrl), sourceUrl, job.evidenceUrls)) {
    record.applicationUrl = "";
    record.unresolvedIssue = [record.unresolvedIssue, "Direct application link was not confirmed by returned source evidence."].filter(Boolean).join(" ");
    record.attentionRequired = true;
    summary.unresolvedIssues.push(`${label}: a proposed application link lacked source evidence, so it was not saved.`);
  }
  if (existing && JSON.stringify(materialFields(existing)) === JSON.stringify(materialFields(record))) {
    summary.duplicatesIgnored++;
    summary.selected.push({ opportunityId: existing.opportunityId, company: record.company, roleTitle: record.roleTitle, outcome: "UNCHANGED_IGNORED" });
    await appendEvent(ownerId, run.id, existing.opportunityId, "EVALUATION", { expected: "Avoid repeated update", observed: "Known opportunity has no material change", outcome: "SUCCESS" });
    return;
  }
  await stage(ownerId, run, "ACT", `${existing ? "Updating" : "Adding"} ${label} in the private collection, then checking it was saved.`, 65 + Math.floor(20 * job.index / Math.max(1, job.result?.selectedOpportunities.length ?? 1)), summary);
  try {
    await saveOpportunity(ownerId, record, existing?.recordVersion ?? null);
    if (existing) summary.updated++; else summary.added++;
    summary.selected.push({ opportunityId: record.opportunityId, company: record.company, roleTitle: record.roleTitle, outcome: existing ? "UPDATED" : "ADDED" });
    await appendEvent(ownerId, run.id, record.opportunityId, "DECISION", { decision: record.agentDecision, rationale: record.decisionRationale, evidence: record.fitEvidence });
    await appendEvent(ownerId, run.id, record.opportunityId, "ACTION", { action: existing ? "COLLECTION_ROW_UPDATED" : "COLLECTION_ROW_ADDED", recordVersion: record.recordVersion, result: "SUCCESS" });
    await appendEvent(ownerId, run.id, record.opportunityId, "OBSERVATION", { postingUrl: sourceUrl, postingStatus: record.postingStatus, sourceReferencedInResponse: true, applicationLinkReferencedInResponse: Boolean(record.applicationUrl) });
    await appendEvent(ownerId, run.id, record.opportunityId, "EVALUATION", { expected: "One current opportunity row", observed: "D1 read-back matched the intended record", outcome: "SUCCESS", notification: "NOT_AVAILABLE_IN_PILOT" });
    await stage(ownerId, run, "REASON", `Scoring ${label} with Jev using the verified fit evidence.`, 78, summary);
    try {
      const score = await scoreSavedOpportunity(ownerId, record.opportunityId, setup, run.id);
      if (score.status === "SCORED") {
        if (score.called) summary.scoresAdded++;
      } else {
        summary.scoresUnavailable++;
        summary.needsAttention++;
        summary.unresolvedIssues.push(`${label}: required Jev score unavailable — ${score.reason} Use Score existing matches to retry when the evidence or provider issue is resolved.`);
      }
    } catch {
      summary.scoresUnavailable++;
      summary.needsAttention++;
      summary.unresolvedIssues.push(`${label}: Jev scoring could not be verified. Use Score existing matches to retry after checking TypeSafe.`);
      await appendEvent(ownerId, run.id, record.opportunityId, "EVALUATION", { expected: "Required evidence-ready preliminary fit score", observed: "Scoring could not be verified", outcome: "PARTIAL SUCCESS" });
    }
  } catch {
    summary.unresolvedIssues.push(`${label}: the collection write or read-back failed; no successful update is claimed.`);
    summary.needsAttention++;
    summary.selected.push({ opportunityId: existing?.opportunityId ?? null, company: record.company, roleTitle: record.roleTitle, outcome: "WRITE_UNVERIFIED" });
    await appendEvent(ownerId, run.id, existing?.opportunityId ?? null, "EVALUATION", { expected: "Verified collection update", observed: "Write or read-back failed", outcome: "FAILURE" });
  }
}

async function finish(ownerId: string, run: RunRecord, job: CollectionJob): Promise<RunRecord> {
  await stage(ownerId, run, "VERIFY", `Checked ${job.summary.added + job.summary.updated} collection writes and recorded any source issues.`, 90, job.summary);
  const recorded = await listOpportunities(ownerId);
  await appendEvent(ownerId, run.id, null, "REMEMBER", { collectionCount: recorded.length, added: job.summary.added, updated: job.summary.updated, unresolvedIssueCount: job.summary.unresolvedIssues.length });
  run.status = job.summary.unresolvedIssues.length ? "PARTIAL_SUCCESS" : "SUCCESS";
  run.stage = "FINISHED"; run.progress = 100; run.finishedAt = new Date().toISOString(); run.summary = job.summary;
  run.detail = `${job.summary.added} added, ${job.summary.updated} updated, ${job.summary.duplicatesIgnored} unchanged duplicates ignored. ${job.summary.scoresAdded} preliminary scores saved; ${job.summary.scoresUnavailable} unavailable. Email is not available in this pilot.`;
  await finishRun(ownerId, run);
  await clearJob(ownerId, run.id);
  return run;
}

export async function advanceResumableCollection(ownerId: string): Promise<RunRecord | null> {
  const run = await latestRun(ownerId);
  if (!run || run.kind !== "COLLECTION" || run.status !== "IN_PROGRESS") return run;
  const token = await lease(ownerId, run.id);
  if (!token) return run;
  let job: CollectionJob | null = null;
  try {
    job = await loadJob(ownerId, run.id);
    if (!job) return run; // The initial request has not yet saved its provider reference.
    const setup = await getStudentSetup(ownerId);
    if (!setup.ready || setup.confirmedAt !== job.profileConfirmedAt) throw new Error("Student setup changed during collection. Start a new run.");
    if (job.phase === "ASSESSMENT_START") {
      if (!job.discovery) throw new Error("The private assessment has no verified discovery checkpoint.");
      job.responseId = await startBackgroundAssessment(realAssessmentPrompt(job.discovery, setup, new Date().toISOString().slice(0, 10)));
      job.phase = "ASSESSMENT"; job.phaseStartedAt = new Date().toISOString();
      await saveJob(ownerId, run.id, job);
      await stage(ownerId, run, "REASON", `Reviewing ${job.discovery.selectedOpportunities.length} source-checked opportunities against the confirmed profile without web access.`, 49, job.summary);
      return run;
    }
    if (job.phase === "DISCOVERY" || job.phase === "ASSESSMENT") {
      if (!job.responseId) throw new HostedOpenAIError("The saved model response reference is missing. Start a new collection run.", "PROVIDER_INVALID_RESPONSE");
      let payload: Record<string, unknown>;
      try { payload = await retrieveBackground(job.responseId); job.pollFailures = 0; }
      catch (error) {
        if (error instanceof HostedOpenAIError && error.code === "PROVIDER_POLL_FAILED" && job.pollFailures < 2) {
          job.pollFailures++;
          await saveJob(ownerId, run.id, job);
          return run;
        }
        throw error;
      }
      if (job.phase === "DISCOVERY") {
        const discovery = readBackgroundDiscovery(payload);
        if (!discovery) {
          if (phaseTimedOut(job)) throw new HostedOpenAIError("Public discovery is still running beyond the review window. The run was stopped without recording unverified results.", "DISCOVERY_TIMEOUT");
          return run;
        }
        job.discovery = discovery.result;
        job.evidenceUrls = discovery.evidenceUrls;
        job.observedSearches = discovery.observedSearches;
        job.summary.searchesPerformed = discovery.observedSearches;
        job.summary.candidatesDiscovered = discovery.result.runSummary.candidatesDiscovered;
        job.summary.duplicatesOrInvalid = discovery.result.runSummary.duplicatesOrInvalid;
        job.summary.candidatesRanked = discovery.result.runSummary.candidatesRanked;
        job.summary.updatesSelected = discovery.result.selectedOpportunities.length;
        job.summary.selectionShortfallReason = discovery.result.runSummary.selectionShortfallReason;
        if (setup.mode === "REAL" && discovery.result.selectedOpportunities.length) {
          job.responseId = null;
          job.phase = "ASSESSMENT_START";
        } else {
          job.result = discovery.result; job.phase = "PROCESS"; job.responseId = null;
          job.summary.unresolvedIssues.push(...discovery.result.unresolvedIssues);
          await appendEvent(ownerId, run.id, null, "SENSE", { searchesPerformed: job.summary.searchesPerformed, candidatesDiscovered: job.summary.candidatesDiscovered, candidatesRanked: job.summary.candidatesRanked, selected: job.summary.updatesSelected, sourceCount: job.evidenceUrls.length });
        }
        await saveJob(ownerId, run.id, job);
        if (job.phase === "ASSESSMENT_START") {
          await stage(ownerId, run, "REASON", `Search complete. Preparing private fit review for ${discovery.result.selectedOpportunities.length} source-checked opportunities.`, 46, job.summary);
        } else {
          await stage(ownerId, run, "REASON_DECIDE", "Checking source evidence and duplicates before saving selected opportunities.", 60, job.summary);
        }
        return run;
      }
      const assessed = readBackgroundAssessment(payload, job.discovery!, job.observedSearches);
      if (!assessed) {
        if (phaseTimedOut(job)) throw new HostedOpenAIError("Private fit assessment is still running beyond the review window. No unverified assessment was saved.", "ASSESSMENT_TIMEOUT");
        return run;
      }
      job.result = assessed; job.phase = "PROCESS"; job.responseId = null;
      job.summary.unresolvedIssues.push(...assessed.unresolvedIssues);
      await appendEvent(ownerId, run.id, null, "SENSE", { searchesPerformed: job.summary.searchesPerformed, candidatesDiscovered: job.summary.candidatesDiscovered, candidatesRanked: job.summary.candidatesRanked, selected: job.summary.updatesSelected, sourceCount: job.evidenceUrls.length });
      await saveJob(ownerId, run.id, job);
      await stage(ownerId, run, "REASON_DECIDE", `Processing ${assessed.selectedOpportunities.length} selected opportunities one at a time.`, 60, job.summary);
      return run;
    }
    if (!job.result) throw new Error("The collection checkpoint has no validated result.");
    if (job.index < job.result.selectedOpportunities.length) {
      await processSelection(ownerId, run, job, setup, job.result.selectedOpportunities[job.index]);
      job.index++;
      await saveJob(ownerId, run.id, job);
      await stage(ownerId, run, "ACT", `Processed ${job.index} of ${job.result.selectedOpportunities.length} selected opportunities; checking the remaining items.`, 60 + Math.floor(25 * job.index / Math.max(1, job.result.selectedOpportunities.length)), job.summary);
      return run;
    }
    return finish(ownerId, run, job);
  } catch (error) {
    return fail(ownerId, run, job?.summary ?? emptySummary(), error);
  } finally {
    await release(ownerId, run.id, token);
  }
}
