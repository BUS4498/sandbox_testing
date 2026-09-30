"use client";

import { useState } from "react";
import type { OpportunityRecord, StudentResponse } from "@/lib/hosted/store";
import { sourceCheckPending, studentResponseNeeded } from "@/lib/hosted/opportunity-state.js";

type Props = {
  record: OpportunityRecord;
  pendingResponse: StudentResponse | undefined;
  disabled: boolean;
  onUpdated: () => Promise<void>;
};

export default function OpportunityUpdate({ record, pendingResponse, disabled, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [responseType, setResponseType] = useState("INFORMATION");
  const [responseText, setResponseText] = useState("");
  const [apiAssessmentConsent, setApiAssessmentConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const modelNeeded = responseType === "INFORMATION" || responseType === "CONFIRMATION";
  const requestedAnswer = studentResponseNeeded(record);
  const sourcePending = sourceCheckPending(record);

  async function submit(action: "SAVE_AND_UPDATE" | "RETRY") {
    setBusy(true); setError(""); setMessage("");
    try {
      const body = action === "RETRY"
        ? { action, opportunityId: record.opportunityId, responseId: pendingResponse?.id }
        : { action, opportunityId: record.opportunityId, recordVersion: record.recordVersion, responseType, responseText, apiAssessmentConsent };
      const request = await fetch("/api/opportunities/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await request.json() as { error?: string; pending?: boolean; run?: { detail: string; status: string } };
      if (!request.ok && request.status !== 202) throw new Error(result.error || "Your response could not be saved.");
      await onUpdated();
      if (result.pending) setMessage(result.error || result.run?.detail || "Your response is saved, but the update needs a retry.");
      else { setMessage(result.run?.detail || "This opportunity was updated and verified."); setOpen(false); setResponseText(""); setApiAssessmentConsent(false); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your response could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="opportunity-update">
    {pendingResponse ? <div className="update-pending"><strong>Saved answer needs review</strong><p>Your {pendingResponse.responseType.toLowerCase().replaceAll("_", " ")} response is saved. The opportunity has not been confirmed as updated. A manual retry may make another billable OpenAI request if the first request reached the provider; Jev scores evidence-ready updates.</p><button type="button" disabled={disabled || busy} onClick={() => void submit("RETRY")}>{busy ? "Retrying…" : "Retry assessment"}</button></div>
      : <button type="button" className="update-toggle" disabled={disabled || busy} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Close update" : requestedAnswer ? "Update Opportunity" : "Add a note or preference"}</button>}
    {open && !pendingResponse && <div className="update-form">
      {requestedAnswer ? <p><strong>What needs your input:</strong> {record.nextActionRequest.prompt}</p>
        : <p><strong>No answer required:</strong> {sourcePending ? "The remaining posting facts need an agent source check. You can still add your own information or mark this opportunity as not interesting." : "You can add information or mark this opportunity as not interesting."}</p>}
      <p className="update-context"><strong>Current recommendation:</strong> {record.agentDecision}. {record.decisionRationale}</p>
      <label>How would you like to respond?
        <select value={responseType} onChange={(event) => { setResponseType(event.target.value); setApiAssessmentConsent(false); }}>
          <option value="INFORMATION">Provide information</option>
          <option value="CONFIRMATION">Confirm the requested details</option>
          <option value="UNKNOWN">I don’t know yet</option>
          <option value="NOT_INTERESTED">Not interested in this opportunity</option>
        </select>
      </label>
      <label>{modelNeeded ? "Your specific answer" : "Optional note"}<textarea rows={3} maxLength={1_500} value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder={modelNeeded ? "Answer each part of the question in your own words; avoid contact details." : "Optional context for your own record"} /></label>
      {modelNeeded && <label className="update-consent"><input type="checkbox" checked={apiAssessmentConsent} onChange={(event) => setApiAssessmentConsent(event.target.checked)} /> Let OpenAI review this non-identifying answer for this opportunity. Jev receives only compact, non-identifying structured evidence when a refreshed score is supported.</label>}
      <p className="update-explanation">Save and Update stores your answer, asks OpenAI whether it changes this opportunity&apos;s fit and recommendation, and verifies the saved result. Jev then refreshes the preliminary score when evidence supports it. New qualifications remain unverified until your confirmed profile supports them. This action performs no internship search or email and never submits an application.</p>
      <button type="button" className="update-submit" disabled={disabled || busy} onClick={() => void submit("SAVE_AND_UPDATE")}>{busy ? "Updating this opportunity…" : "Save and Update"}</button>
    </div>}
    {error && <p role="alert" className="update-error">{error}</p>}
    {message && <p role="status" className="update-message">{message}</p>}
  </div>;
}
