"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { OpportunityRecord } from "@/lib/hosted/store";
import type { SavedInterviewPractice } from "@/lib/hosted/interview-practice";

type Props = { record: OpportunityRecord; result?: SavedInterviewPractice; available: boolean; disabled: boolean; onPrepared: () => Promise<void> };

export default function InterviewPractice({ record, result, available, disabled, onPrepared }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const stale = Boolean(result && result.opportunityVersion !== record.recordVersion);

  async function prepare() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/interview-practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: record.opportunityId, requestId: crypto.randomUUID() }) });
      const data = await response.json() as { error?: string; run?: { status: string; detail: string } };
      if (!response.ok && response.status !== 207) throw new Error(data.error || "Interview practice could not be prepared.");
      await onPrepared();
      if (data.run?.status !== "SUCCESS") throw new Error(data.run?.detail || "Interview practice could not be verified.");
      setNotice(data.run.detail);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Interview practice could not be prepared."); }
    finally { setBusy(false); }
  }

  return <section className="interview-practice" aria-label={`Interview practice for ${record.company} ${record.roleTitle}`}>
    <button type="button" className="interview-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Close interview practice" : "Practice Interview"}</button>
    {open && <div className="interview-panel">
      <p>Research public reports of questions and interview stages in separate searches. Verified reports link to their sources; anything not confirmed is labeled as general practice. Research runs only when you click below and may use paid API calls.</p>
      <button type="button" className="interview-start" disabled={!available || disabled || busy} onClick={() => void prepare()}>{busy ? "Researching questions and process…" : result ? "Refresh interview research" : "Research interview questions and process"}</button>
      {!available && <p className="interview-error">Interview research or private Word storage is not configured.</p>}
      {error && <p className="interview-error" role="alert">{error}</p>}
      {notice && <p className="interview-notice" role="status">{notice}</p>}
      {result && <div className="interview-results">
        <p className="interview-meta">Prepared {new Date(result.preparedAt).toLocaleString()} · {result.searchesPerformed} web searches · {result.sourcesInspected} pages inspected</p>
        {stale && <p className="interview-error">This opportunity changed after this research was prepared. Refresh before relying on it.</p>}
        <h4>Publicly reported questions</h4>
        {result.reportedQuestions.length ? <ul>{result.reportedQuestions.map((item, index) => <li key={`reported-${index}`}><span>{item.question}</span><small>{item.roleMatch === "EXACT_ROLE" ? "Same role" : "Related role"} · {item.sourceDate} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} source</a></small></li>)}</ul> : <p>No actual asked question was verified in an accessible public candidate account.</p>}
        <h4>Publicly reported interview process</h4>
        {(result.reportedProcess ?? []).length ? <ul>{result.reportedProcess.map((item, index) => <li key={`process-${index}`}><span>{item.description}</span><small>{item.sourceKind === "EMPLOYER_GUIDANCE" ? "Employer guidance" : "Candidate account"} · {item.roleMatch === "EXACT_ROLE" ? "Same role" : "Related role"} · {item.sourceDate} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} source</a></small></li>)}</ul> : <p>No role-specific interview procedure was verified. The actual stages, format, and timing remain unknown.</p>}
        <h4>Likely questions to practice</h4>
        <p className="interview-caveat">Generated preparation prompts—not questions confirmed to have been asked by this employer.</p>
        {result.likelyQuestions.length ? <ul>{result.likelyQuestions.map((question, index) => <li key={`likely-${index}`}>{question}</li>)}</ul> : <p>No additional likely questions were prepared.</p>}
        <h4>General process preparation</h4>
        <p className="interview-caveat">Possible preparations, not this employer’s confirmed procedure.</p>
        {(result.generalProcessGuidance ?? []).length ? <ul>{result.generalProcessGuidance.map((item, index) => <li key={`guidance-${index}`}>{item}</li>)}</ul> : <p>Ask the recruiter to confirm the actual process.</p>}
        {result.searchNotes && <p className="interview-note">{result.searchNotes}</p>}
        <a className="interview-download" href={`/api/materials/${encodeURIComponent(result.materialId)}`}><FileDown size={16} aria-hidden="true" /> Download Word practice guide</a>
      </div>}
    </div>}
  </section>;
}
