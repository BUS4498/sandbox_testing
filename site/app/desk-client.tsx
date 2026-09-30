"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CircleAlert, FileCheck2, FolderOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpportunityRecord, RunRecord, StudentResponse, StudentSetup } from "@/lib/hosted/store";
import { isMultiOpportunityIndexUrl } from "@/lib/hosted/source-links.js";
import { sortOpportunities } from "@/lib/hosted/opportunity-sort.js";
import { finalAssessmentIssues } from "@/lib/hosted/assessment-issues.js";
import { assessmentMatchesSetup, sourceCheckPending, studentResponseNeeded } from "@/lib/hosted/opportunity-state.js";
import StudentSetupCard from "./student-setup";
import ResetCollection from "./reset-collection";
import OpportunityList from "./opportunity-list";
import type { SavedInterviewPractice } from "@/lib/hosted/interview-practice";
import type { MaterialRecord } from "@/lib/hosted/materials-store";

export type Status = { keyConfigured: boolean; jevConfigured: boolean; setup: StudentSetup; run: RunRecord | null; opportunities: OpportunityRecord[]; studentResponses: StudentResponse[]; materials: MaterialRecord[]; interviewPractice: SavedInterviewPractice[]; collectAllowance?: { allowed: boolean; reason: string; retryAt: string | null }; capabilities?: { wordDrafts?: boolean; interviewPractice?: boolean; reset?: boolean } };
type Connection = { status: string; detail: string };
type Selection = { opportunityId: string | null; company: string; roleTitle: string; outcome: string };

function elapsed(start: string, end?: string | null): string {
  const seconds = Math.max(0, Math.round((new Date(end ?? Date.now()).getTime() - new Date(start).getTime()) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}
function count(summary: Record<string, unknown> | null | undefined, key: string): number {
  return Number(summary?.[key] ?? 0) || 0;
}
function scoreUpdateMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const result = value as { status?: string; called?: boolean; reason?: string };
  if (result.status === "SCORED") return result.called
    ? "Preliminary fit was refreshed from your updated evidence. Review the matches and gaps before deciding."
    : "The prior preliminary score was reused because its underlying evidence did not change.";
  if (result.status === "FAILED") return "Your opportunity update was saved, but its Jev score could not be verified. Use Score existing matches to retry after checking TypeSafe.";
  return result.reason ? `Preliminary fit is unavailable: ${result.reason}` : "Preliminary fit is unavailable until enough verified evidence is present.";
}

export default function DeskClient({ previewStatus }: { previewStatus?: Status }) {
  const preview = Boolean(previewStatus);
  const [status, setStatus] = useState<Status | null>(previewStatus ?? null);
  const [connection, setConnection] = useState<Connection | null>(preview ? { status: "PREVIEW", detail: "Visual preview only. No provider request is made." } : null);
  const [jevConnection, setJevConnection] = useState<Connection | null>(preview ? { status: "PREVIEW", detail: "Visual preview only. No provider request is made." } : null);
  const [loading, setLoading] = useState(!preview);
  const [checking, setChecking] = useState(false);
  const [checkingJev, setCheckingJev] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [sortMode, setSortMode] = useState<"score" | "recent">("score");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "source" | "prioritize">("all");
  const [celebrating, setCelebrating] = useState(false);
  const previousRun = useRef<{ id: string; status: string } | null>(null);
  const advancing = useRef(false);
  const [error, setError] = useState("");
  const [, tick] = useState(0);
  const refresh = useCallback(async () => {
    if (previewStatus) return;
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const data = await response.json() as Status & { error?: string };
      if (!response.ok) throw new Error(data.error || "The private collection could not be loaded.");
      setStatus(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The private collection could not be loaded."); }
    finally { setLoading(false); }
  }, [previewStatus]);
  useEffect(() => { if (preview) return; const timer = setTimeout(() => { void refresh(); }, 0); return () => clearTimeout(timer); }, [preview, refresh]);
  useEffect(() => {
    if (preview) return;
    if (!collecting && status?.run?.status !== "IN_PROGRESS") return;
    const timer = setInterval(() => {
      if (advancing.current) return;
      advancing.current = true;
      void (async () => {
        try {
          if (status?.run?.kind === "COLLECTION" && status.run.status === "IN_PROGRESS") {
            const response = await fetch("/api/collect/advance", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            if (!response.ok) setError("Progress could not be checked. The run is saved; the next check will retry.");
          }
          await refresh();
          tick((value) => value + 1);
        } finally { advancing.current = false; }
      })();
    }, 3000);
    return () => clearInterval(timer);
  }, [collecting, status?.run?.kind, status?.run?.status, refresh, preview]);
  useEffect(() => {
    const current = status?.run;
    if (!current) return;
    const prior = previousRun.current;
    previousRun.current = { id: current.id, status: current.status };
    if (preview || !prior || current.status !== "SUCCESS" || (prior.id === current.id && prior.status !== "IN_PROGRESS")) return;
    const start = setTimeout(() => setCelebrating(true), 0);
    const stop = setTimeout(() => setCelebrating(false), 1800);
    return () => { clearTimeout(start); clearTimeout(stop); };
  }, [status?.run, preview]);
  async function checkConnection() {
    setChecking(true); setError("");
    try {
      const response = await fetch("/api/connection", { cache: "no-store" });
      const data = await response.json() as Connection;
      setConnection(data);
      if (!response.ok) setError(data.detail);
    } catch { setConnection({ status: "NETWORK_UNAVAILABLE", detail: "The private connection check could not be completed." }); }
    finally { setChecking(false); }
  }
  async function checkJevConnection() {
    setCheckingJev(true);
    try {
      const response = await fetch("/api/jev-connection", { cache: "no-store" });
      const data = await response.json() as Connection;
      setJevConnection(data);
    } catch { setJevConnection({ status: "NETWORK_UNAVAILABLE", detail: "The private Jev connection check could not be completed. No score was requested." }); }
    finally { setCheckingJev(false); }
  }
  async function collect() {
    setCollecting(true); setError("");
    try {
      const response = await fetch("/api/collect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string; retryAt?: string | null; run?: RunRecord };
      if (!response.ok && !data.run) throw new Error(`${data.error || "The collection run could not start."}${data.retryAt ? ` Try again after ${new Date(data.retryAt).toLocaleString()}.` : ""}`);
      if (data.run?.status === "FAILURE") setError(data.run.detail || "The collection run failed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The collection run could not be completed."); }
    finally { setCollecting(false); await refresh(); }
  }
  async function scoreExisting() {
    setScoring(true); setError("");
    try {
      const response = await fetch("/api/fit-score/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json() as { error?: string; run?: RunRecord };
      if (!response.ok) throw new Error(data.error || "Existing opportunities could not be scored.");
      if (data.run?.status === "FAILURE") setError(data.run.detail);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Existing opportunities could not be scored."); }
    finally { setScoring(false); await refresh(); }
  }
  const run = status?.run;
  const active = collecting || scoring || run?.status === "IN_PROGRESS";
  const summary = run?.summary;
  const records = status?.opportunities ?? [];
  const materials = status?.materials ?? [];
  const displayedRecords = sortOpportunities(records, status?.setup?.mode, sortMode, status?.setup?.confirmedAt);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRecords = displayedRecords.filter((record) => {
    if (filter === "attention" && !studentResponseNeeded(record)) return false;
    if (filter === "source" && !sourceCheckPending(record)) return false;
    if (filter === "prioritize" && (record.agentDecision !== "PRIORITIZE" || !assessmentMatchesSetup(record, status?.setup))) return false;
    return !normalizedQuery || `${record.company} ${record.roleTitle} ${record.location}`.toLowerCase().includes(normalizedQuery);
  });
  const stage = (run?.stage ?? "").toUpperCase();
  const AgentTool = /SEARCH|SENSE/.test(stage) ? Search : /VERIFY/.test(stage) ? FileCheck2 : FolderOpen;
  const scoreUpdate = run?.kind === "TARGETED_UPDATE" ? scoreUpdateMessage(summary?.fitScore) : null;
  const selections = Array.isArray(summary?.selected) ? summary.selected as Selection[] : [];
  const rawIssues = Array.isArray(summary?.unresolvedIssues) ? summary.unresolvedIssues as string[] : [];
  const issues = run?.kind === "COLLECTION" && ["SUCCESS", "PARTIAL_SUCCESS"].includes(run.status)
    ? finalAssessmentIssues([], rawIssues) as string[]
    : rawIssues;
  const attentionCount = records.filter(studentResponseNeeded).length;
  const sourceCheckCount = records.filter(sourceCheckPending).length;
  const legacyListCollision = records.some((record) => isMultiOpportunityIndexUrl(record.postingUrl)) && selections.some((item) => item.outcome === "DUPLICATE_IN_RUN");
  const targeted = run?.kind === "TARGETED_UPDATE";
  const backfillRun = run?.kind === "FIT_BACKFILL";
  const materialRun = run?.kind === "MATERIAL_PREP";
  const interviewRun = run?.kind === "INTERVIEW_PRACTICE";
  return <main className="desk">
    {preview && <p className="preview-banner" role="status">Visual preview with synthetic examples. Collection, updates, downloads, and external links are disabled here; the live Site has not changed.</p>}
    <header className="desk-header"><div className="brand-line"><span className="brand-mark">IP</span><div><strong>Internship Prep Desk</strong><small>Signed-in student workspace · {status?.setup?.mode === "REAL" ? "confirmed student setup" : status?.setup?.mode === "SYNTHETIC_DEMONSTRATION" ? "synthetic demonstration" : "setup required"}</small></div></div><span className="privacy-pill">Your workspace</span></header>
    <section className="workbench" aria-labelledby="desk-title">
      <div className="workbench-copy">
        <p className="eyebrow">YOUR INTERNSHIP RADAR</p><h1 id="desk-title">Find your next move. <span>Stay one step ahead.</span></h1>
        <p className="intro">Discover a short list of relevant internships, see why they fit, and get your materials ready. Nothing is submitted for you.</p>
        <StudentSetupCard setup={status?.setup} disabled={preview || active || loading} preview={preview} onSaved={refresh} />
        <div className="provider-checks" aria-label="Provider connections">
          <div className={`provider-check ${connection?.status === "VERIFIED" ? "is-verified" : ""}`}><div><strong>OpenAI <span>Discovery</span></strong><p role="status">{connection?.detail ?? (status?.keyConfigured ? "Configured, not checked yet." : "Private key not configured.")}</p></div><Button className="provider-check-button" variant="outline" size="sm" onClick={checkConnection} disabled={preview || checking || active}>{checking ? "Checking…" : "Check OpenAI"}</Button></div>
          <div className={`provider-check ${jevConnection?.status === "VERIFIED" ? "is-verified" : ""}`}><div><strong>Jev <span>Fit scoring</span></strong><p role="status">{jevConnection?.detail ?? (status?.jevConfigured ? "Configured, not checked yet. Check Jev before collecting." : "Private TypeSafe key not configured. Jev is required for evidence-ready matches.")}</p></div><Button className="provider-check-button" variant="outline" size="sm" onClick={checkJevConnection} disabled={preview || checkingJev || active}>{checkingJev ? "Checking…" : "Check Jev"}</Button></div>
        </div>
        <div className="action-row"><Button className="collect-button" onClick={collect} disabled={preview || connection?.status !== "VERIFIED" || jevConnection?.status !== "VERIFIED" || !status?.setup?.ready || status?.collectAllowance?.allowed === false || active || loading}><Search size={17} />{active ? "Collecting…" : "Collect Opportunities"}</Button><span>Matching may take about 5 minutes · one Collect run per 24 hours · up to 10 searches and 5 updates</span></div>
        {!preview && status?.collectAllowance?.allowed === false && <p className="connection-note" role="status">{status.collectAllowance.reason}{status.collectAllowance.retryAt ? ` You can try again after ${new Date(status.collectAllowance.retryAt).toLocaleString()}.` : " Please try again later."}</p>}
        <p className="connection-note">{preview ? "Visual preview only. No AI or web search runs from this page." : !status?.setup?.ready ? "Complete and confirm your student setup before collecting. Demo mode is optional." : connection?.status === "VERIFIED" && jevConnection?.status === "VERIFIED" ? "OpenAI discovers and assesses opportunities; Jev scores evidence-ready matches. This class Site funds runs within its daily limits; no provider key is needed from you." : "Check both OpenAI and Jev to enable collection. These checks do not generate content or a score."}</p>
        {error && <p role="alert" className="inline-error"><CircleAlert size={17} />{error}</p>}
      </div>
      <aside className={`agent-panel ${active ? "agent-working" : "agent-idle"} ${run?.status === "FAILURE" && !active ? "agent-failure" : ""} ${celebrating ? "agent-celebrate" : ""}`} aria-label="Agent status"><div className="agent-glyph" aria-hidden="true"><span className="antenna" /><span className="face"><i /><i /></span><span className="torso"><i /></span>{active && <span className="agent-prop"><AgentTool size={19} /></span>}<span className="agent-sparkle">✦</span></div>
        <div className="agent-card"><span>{active ? "WHAT THE AGENT IS DOING" : "AGENT STATUS"}</span><strong>{active ? run?.stage?.replaceAll("_", " ") || "Starting" : run?.status === "FAILURE" ? "Action required" : attentionCount ? `${attentionCount} ${attentionCount === 1 ? "opportunity needs" : "opportunities need"} your input` : sourceCheckCount ? `${sourceCheckCount} source ${sourceCheckCount === 1 ? "check" : "checks"} pending` : "Ready when you are"}</strong><p>{active || run?.status === "FAILURE" ? run?.detail || "The workflow is starting." : attentionCount ? "Review the opportunities marked for your attention below. You can answer a specific question without starting another search." : sourceCheckCount ? "These postings need an employer-source check, not an answer from you. A later Collect run can recheck up to two within its search budget; an inaccessible source may remain unresolved. Scores stay unavailable until verified." : "Choose a role below or collect new opportunities."}</p>{active && <><div className="progress-track" role="progressbar" aria-label="Workflow progress" aria-valuenow={run?.progress ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${run?.progress ?? 0}%` }} /></div><small>{run?.progress ?? 0}% · {run ? `Elapsed ${elapsed(run.startedAt)}` : "Starting"}</small></>}</div>
      </aside>
    </section>
    <section className="summary" aria-label="Collection summary"><div><span>Tracked opportunities</span><strong>{records.length}</strong></div><div><span>New this run</span><strong>{count(summary, "added")}</strong></div><div><span>Your input needed</span><strong>{attentionCount}</strong></div><div><span>Source checks pending</span><strong>{sourceCheckCount}</strong></div></section>
    {run && <details key={run.id} className="run-report" open={run.status === "FAILURE" || run.status === "PARTIAL_SUCCESS" ? true : undefined}>
      <summary className="run-report-summary"><span className="eyebrow">LATEST WORKFLOW</span><strong>{interviewRun ? "Interview practice" : materialRun ? "Word draft preparation" : backfillRun ? "Existing fit scores" : targeted ? "Opportunity update" : "Today’s collection"}</strong><span className={`run-badge ${run.status.toLowerCase()}`}>{run.status.replaceAll("_", " ")}</span><small>{elapsed(run.startedAt,run.finishedAt)} · View run details</small></summary>
      <div className="run-report-body">
        <p>{run.detail}</p>
        {interviewRun ? <div className="targeted-report"><div><span>Searches</span><strong>{count(summary,"searchesPerformed")}</strong><span>Reported questions</span><strong>{count(summary,"reported")}</strong><span>Process details</span><strong>{count(summary,"process")}</strong><span>Likely practice</span><strong>{count(summary,"likely")}</strong><span>Duration</span><strong>{elapsed(run.startedAt,run.finishedAt)}</strong></div></div>
          : materialRun ? <div className="targeted-report"><div><span>Requested</span><strong>{count(summary,"requested")}</strong><span>Prepared</span><strong>{Array.isArray(summary?.prepared) ? summary.prepared.length : 0}</strong><span>Duration</span><strong>{elapsed(run.startedAt,run.finishedAt)}</strong></div>{Array.isArray(summary?.unresolvedIssues) && (summary.unresolvedIssues as string[]).map((issue,index) => <p key={index} className="report-note">{issue}</p>)}</div>
          : backfillRun ? <div className="targeted-report"><div><span>Examined</span><strong>{count(summary,"examined")}</strong><span>TypeSafe calls</span><strong>{count(summary,"providerCalls")}</strong><span>Scored</span><strong>{count(summary,"scored")}</strong><span>Duration</span><strong>{elapsed(run.startedAt,run.finishedAt)}</strong></div>{Array.isArray(summary?.notes) && (summary.notes as string[]).map((note,index) => <p key={index} className="report-note">{note}</p>)}</div>
          : targeted ? <div className="targeted-report"><div><span>Searches</span><strong>0</strong><span>Outcome</span><strong>{String(summary?.outcome ?? (active ? "Processing" : "Unknown")).replaceAll("_", " ")}</strong><span>Duration</span><strong>{elapsed(run.startedAt,run.finishedAt)}</strong></div>{typeof summary?.responseExplanation === "string" && <p>{summary.responseExplanation}</p>}</div>
          : <><div className="run-metrics">{[["Searches","searchesPerformed"],["Discovered","candidatesDiscovered"],["Excluded","duplicatesOrInvalid"],["Ranked","candidatesRanked"],["Selected","updatesSelected"],["Added","added"],["Updated","updated"],["Jev scored","scoresAdded"],["Emails sent","notificationsSent"]].map(([label,key]) => <div key={key}><span>{label}</span><strong>{count(summary,key)}</strong></div>)}<div><span>Duration</span><strong>{elapsed(run.startedAt,run.finishedAt)}</strong></div></div>{typeof summary?.selectionShortfallReason === "string" && summary.selectionShortfallReason.length > 0 && <p className="report-note">Selection: {summary.selectionShortfallReason}</p>}{selections.length > 0 && <div className="selected-list"><h3>Selected opportunities</h3>{selections.map((item,index) => <p key={`${item.opportunityId ?? item.company}-${index}`}>{item.company} — {item.roleTitle} <span>{item.outcome.replaceAll("_"," ")}</span></p>)}</div>}{issues.length > 0 && <div className="issue-list"><h3>Unresolved issues</h3>{issues.map((item,index) => <p key={index}><CircleAlert size={16} />{item}</p>)}</div>}</>}
      </div>
    </details>}
    {scoreUpdate && <p className="score-update-note" role="status">{scoreUpdate}</p>}
    {legacyListCollision && <p className="legacy-warning">Correction to the previous run: one multi-role list URL was reused for different jobs. Three were incorrectly labeled duplicates and were not saved. The app now requires each role’s individual posting before adding it.</p>}
    <section className="collection">
      <div className="section-head"><div><p className="eyebrow">YOUR SHORTLIST</p><h2>Opportunities</h2></div><div className="collection-actions"><label className="collection-sort">Sort by <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "score" | "recent")} aria-label="Sort opportunities"><option value="score">Highest preliminary fit</option><option value="recent">Recently reviewed</option></select></label><Button variant="outline" size="sm" onClick={scoreExisting} disabled={preview || !status?.jevConfigured || !status?.setup?.ready || !records.length || active || loading} title="Score at most five existing evidence-ready opportunities; no web search or email is used">{scoring ? "Scoring…" : "Score existing matches"}</Button>{preview ? <span className="download-link preview-action"><ArrowDownToLine size={17} /> Download spreadsheet</span> : <a className="download-link" href="/api/collection.xlsx"><ArrowDownToLine size={17} /> Download spreadsheet</a>}{status && <ResetCollection available={Boolean(status.capabilities?.reset) && !preview} preview={preview} disabled={active || loading} onReset={refresh} />}</div></div>
      <div className="collection-find"><label><Search size={17} aria-hidden="true" /><span className="sr-only">Search opportunities</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, role, or location" aria-label="Search opportunities" /></label><div className="collection-filters" role="group" aria-label="Filter opportunities"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span>{records.length}</span></button><button type="button" aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>Your input <span>{attentionCount}</span></button><button type="button" aria-pressed={filter === "source"} onClick={() => setFilter("source")}>Source checks <span>{sourceCheckCount}</span></button><button type="button" aria-pressed={filter === "prioritize"} onClick={() => setFilter("prioritize")}>Prioritize <span>{records.filter((record) => record.agentDecision === "PRIORITIZE" && assessmentMatchesSetup(record, status?.setup)).length}</span></button></div></div>
      <p className="sort-help">{sortMode === "score" ? "Current preliminary scores appear first; unavailable or outdated scores follow." : "Most recently reviewed opportunities appear first."} Sorting never changes an agent recommendation.</p>
      <details className="collection-tools"><summary>About preliminary fit scoring</summary><p className="score-help">TypeSafe/Jev scores evidence-ready matches from a compact non-identifying summary. A score is not a hiring probability or application decision. If evidence is insufficient or scoring fails, the opportunity stays visible with a clear reason and retry action. A backfill makes at most five provider calls; unchanged successful evidence is reused. {status?.jevConfigured ? "The private TypeSafe key is configured." : "The private TypeSafe key is not configured."}</p></details>
      {loading ? <p className="empty-state">Loading the private collection…</p> : records.length === 0 ? <p className="empty-state">No opportunities are recorded yet. Search results appear only after a successful private write.</p> : visibleRecords.length === 0 ? <p className="empty-state">No opportunities match this view. Clear the search or choose All to see the full collection.</p> : <OpportunityList records={visibleRecords} activeMode={status?.setup?.mode} activeConfirmedAt={status?.setup?.confirmedAt} materials={materials} responses={status?.studentResponses ?? []} interviewPractice={status?.interviewPractice ?? []} active={active} setupReady={Boolean(status?.setup?.ready)} wordDraftsAvailable={Boolean(status?.capabilities?.wordDrafts)} interviewAvailable={Boolean(status?.capabilities?.interviewPractice)} preview={preview} onUpdated={refresh} />}
    </section>
    <section className="pilot-boundary"><p>Your signed-in workspace keeps your setup, collection, drafts, and reset archives separate from other students. Spreadsheet download is generated from your current records. You may separately authorize private original-resume retention; only your confirmed, non-identifying profile is sent for model assessment. Live email remains disabled. Reset Collection creates your private recovery archive before clearing your active records. Collection runs only when you choose Collect Opportunities; automatic Daily Run is off.</p></section>
  </main>;
}
