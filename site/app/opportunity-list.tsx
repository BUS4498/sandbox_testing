"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { OpportunityRecord, StudentResponse, StudentSetup } from "@/lib/hosted/store";
import type { MaterialRecord } from "@/lib/hosted/materials-store";
import type { SavedInterviewPractice } from "@/lib/hosted/interview-practice";
import { currentPreliminaryScore } from "@/lib/hosted/opportunity-sort.js";
import { assessmentMatchesSetup, cleanNextAction, sourceCheckPending, studentResponseNeeded } from "@/lib/hosted/opportunity-state.js";
import { isMultiOpportunityIndexUrl, isSecondaryListing } from "@/lib/hosted/source-links.js";
import OpportunityUpdate from "./opportunity-update";
import MaterialsWorkspace from "./materials-workspace";
import InterviewPractice from "./interview-practice";

type Props = {
  records: OpportunityRecord[];
  activeMode: StudentSetup["mode"] | undefined;
  activeConfirmedAt: string | null | undefined;
  materials: MaterialRecord[];
  responses: StudentResponse[];
  interviewPractice: SavedInterviewPractice[];
  active: boolean;
  setupReady: boolean;
  wordDraftsAvailable: boolean;
  interviewAvailable: boolean;
  preview?: boolean;
  onUpdated: () => Promise<void>;
};

function displayDate(value: string): string {
  if (!value || value.toLowerCase() === "unknown") return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function EvidenceList({ title, items, kind }: { title: string; items: string[]; kind: "matches" | "gaps" }) {
  if (items.length === 0) return null;
  return <section className={`opportunity-evidence ${kind}`} aria-label={title}>
    <h4>{title}</h4>
    <ul>{items.slice(0, 3).map((item, index) => <li key={`${kind}-${index}`}>{item}</li>)}</ul>
  </section>;
}

function PreliminaryFit({ record, activeMode, activeConfirmedAt, preview }: { record: OpportunityRecord; activeMode: StudentSetup["mode"] | undefined; activeConfirmedAt: string | null | undefined; preview: boolean }) {
  const score = record.fitScore;
  const currentProfile = assessmentMatchesSetup(record, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null });
  const currentScore = currentPreliminaryScore(record, activeMode, activeConfirmedAt);
  const available = currentScore !== null;
  const unavailableReason = !currentProfile
    ? "This assessment predates your current confirmed student setup. Reassess the opportunity before using its fit result."
    : record.postingStatus === "CLOSED"
        ? "The posting is closed, so it is not scored as a current opportunity."
        : score?.status === "PENDING"
          ? "A prior scoring attempt has an unconfirmed outcome and is not retried automatically."
          : score?.reason || "Verified evidence has not yet supported a preliminary score.";
  return <section className={`preliminary-fit ${available ? "scored" : "unavailable"}`} aria-label="Preliminary fit indicator">
    <div><span>{preview ? "Illustrative preliminary fit" : "Preliminary fit · TypeSafe Jev"}</span><strong>{available ? `${currentScore}/100` : !currentProfile ? "Needs reassessment" : "Score unavailable"}</strong></div>
    <p>{available ? "A rounded evidence-alignment indicator, not a hiring probability. Review the matches and gaps before deciding." : unavailableReason}</p>
    {available && <small>Scored {displayDate(score?.scoredAt || "")} · The recommendation remains independent of this number.</small>}
    {record.postingStatus === "UNCERTAIN" && <small>Active status is unconfirmed. This score measures evidence alignment, not whether applications are open.</small>}
  </section>;
}

function ApplyLink({ record, preview }: { record: OpportunityRecord; preview: boolean }) {
  const active = record.postingStatus === "ACTIVE";
  const linkText = active ? "Apply" : "Check posting";
  const label = active && record.applicationUrl ? `Open application page for ${record.company} ${record.roleTitle}` : `Check the original posting for ${record.company} ${record.roleTitle}; availability is not confirmed`;
  if (preview) return <span className="apply-link preview-action" aria-label="Posting link unavailable in visual preview">{linkText} <ArrowUpRight size={17} aria-hidden="true" /></span>;
  return <a className="apply-link" href={active && record.applicationUrl ? record.applicationUrl : record.postingUrl} target="_blank" rel="noopener noreferrer" aria-label={label}>{linkText} <ArrowUpRight size={17} aria-hidden="true" /></a>;
}

export default function OpportunityList({ records, activeMode, activeConfirmedAt, materials, responses, interviewPractice, active, setupReady, wordDraftsAvailable, interviewAvailable, preview = false, onUpdated }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const selected = records.find((record) => record.opportunityId === selectedId) ?? null;
  const selectedCurrent = selected ? assessmentMatchesSetup(selected, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null }) : false;

  return <>
    <div className="opportunity-list">
      {records.map((record) => {
        const score = currentPreliminaryScore(record, activeMode, activeConfirmedAt);
        const currentProfile = assessmentMatchesSetup(record, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null });
        const scoreLabel = score !== null ? `${score}/100 preliminary` : !currentProfile ? "Needs reassessment" : "Score unavailable";
        const studentTask = studentResponseNeeded(record);
        const sourceTask = sourceCheckPending(record);
        const action = currentProfile
          ? cleanNextAction(studentTask ? record.nextActionRequest.prompt : record.nextAction)
          : "Reassess this role for your current confirmed resume.";
        return <article key={record.opportunityId} className={`opportunity-row ${record.attentionRequired ? "has-attention" : ""}`}>
          <div className="opportunity-row-main">
            <div className="opportunity-top"><div><span className="company">{record.company}</span><h3>{record.roleTitle}</h3></div><div className="row-badges"><span className="decision-pill">{currentProfile ? record.agentDecision.replaceAll("_", " ") : "REASSESS"}</span><span className="row-score">{scoreLabel}</span></div></div>
            <p className="opportunity-meta">{record.location || "Location unknown"} · {record.workArrangement || "Arrangement unknown"} · Deadline {displayDate(record.deadline)}</p>
            {record.postingStatus === "UNCERTAIN" && <p className="link-note">Accepted source listing · active status unconfirmed</p>}
            <p className="opportunity-rationale">{currentProfile ? record.decisionRationale : "This role was assessed for an earlier student setup. Its fit and recommendation have not yet been checked against your current confirmed resume."}</p>
            <p className="row-next-action"><strong>{studentTask ? "Your next step" : sourceTask ? "Posting details to confirm" : "Next step"}</strong> {action || "Review the posting details before deciding what to do."}</p>
          </div>
          <div className="row-actions">
            <button type="button" className="detail-button" onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedId(record.opportunityId); }} aria-label={`Review details for ${record.company} ${record.roleTitle}`}>Review details <ChevronRight size={17} aria-hidden="true" /></button>
            <div className="opportunity-links"><ApplyLink record={record} preview={preview} /></div>
          </div>
        </article>;
      })}
    </div>
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
      {selected && <SheetContent side="right" className="opportunity-sheet" onCloseAutoFocus={(event) => { event.preventDefault(); detailTrigger.current?.focus(); }}>
        <SheetHeader className="opportunity-sheet-header">
          <span className="company">{selected.company}</span>
          <SheetTitle>{selected.roleTitle}</SheetTitle>
          <SheetDescription>{selected.location || "Location unknown"} · {selected.workArrangement || "Arrangement unknown"} · Deadline {displayDate(selected.deadline)}</SheetDescription>
          <div className="sheet-badges"><span className="decision-pill">{selectedCurrent ? selected.agentDecision.replaceAll("_", " ") : "REASSESS"}</span><span>Application status: {selected.applicationStatus.replaceAll("_", " ")}</span></div>
        </SheetHeader>
        <div className="opportunity-sheet-scroll">
          <section className="detail-next-action"><h3>{sourceCheckPending(selected) ? "Posting details to confirm" : "What to do next"}</h3><p>{selectedCurrent ? cleanNextAction(selected.nextAction) : "Reassess this role for your current confirmed resume."}</p>{selectedCurrent && studentResponseNeeded(selected) && <p><strong>Information to provide:</strong> {selected.nextActionRequest.prompt}</p>}
            {sourceCheckPending(selected) && <p>This listing is retained while its active status or other details remain unconfirmed. Employer confirmation is not required for assessment or evidence-ready scoring. Check current availability before applying; you do not need to answer an employer-source question.</p>}
            {selected.nextAction.includes("Student Setup") && <a href="#setup-title" onClick={() => setSelectedId(null)}>Go to Student Setup</a>}
            {selectedCurrent ? <OpportunityUpdate record={selected} pendingResponse={responses.find((item) => item.opportunityId === selected.opportunityId && item.status === "PENDING")} disabled={active || !setupReady || preview} onUpdated={onUpdated} /> : <p>Update Opportunity is paused until this role has a current-profile assessment.</p>}
          </section>
          <p className="detail-rationale">{selectedCurrent ? selected.decisionRationale : "The prior fit explanation belongs to an earlier student setup and is hidden until this role is reassessed for the current resume."}</p>
          <p className="assessment-mode">Assessed with {selected.assessmentProfileMode === "REAL" ? "confirmed real-student setup" : "synthetic demonstration setup"}. {!assessmentMatchesSetup(selected, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null }) ? "This earlier assessment has not been updated for your current confirmed profile." : ""}</p>
          <PreliminaryFit record={selected} activeMode={activeMode} activeConfirmedAt={activeConfirmedAt} preview={preview} />
          {selectedCurrent && <EvidenceList title="Verified matches" items={[...selected.fitEvidence.requiredMatches, ...selected.fitEvidence.preferredMatches]} kind="matches" />}
          {selectedCurrent && <EvidenceList title="Gaps to consider" items={selected.fitEvidence.gaps} kind="gaps" />}
          <details className="posting-evidence"><summary>Posting details used for preparation</summary>
            {(selected.responsibilities?.length || selected.requiredQualifications?.length || selected.preferredQualifications?.length) ? <>
              <EvidenceList title="Responsibilities" items={selected.responsibilities ?? []} kind="matches" />
              <EvidenceList title="Required qualifications" items={selected.requiredQualifications ?? []} kind="matches" />
              <EvidenceList title="Preferred qualifications" items={selected.preferredQualifications ?? []} kind="matches" />
            </> : <p>This earlier record does not retain the posting&apos;s duties or qualifications. Refresh the posting before expecting fully role-specific materials or interview prompts.</p>}
          </details>
          <MaterialsWorkspace record={selected} materials={materials.filter((item) => item.opportunityId === selected.opportunityId && item.type !== "INTERVIEW_PRACTICE")} activeMode={activeMode} activeConfirmedAt={activeConfirmedAt} available={wordDraftsAvailable} disabled={active || !setupReady || preview} onPrepared={onUpdated} />
          <InterviewPractice record={selected} result={interviewPractice.find((item) => item.opportunityId === selected.opportunityId)} available={interviewAvailable} disabled={active || preview} onPrepared={onUpdated} />
          <div className="opportunity-links"><ApplyLink record={selected} preview={preview} />
            {!preview && selected.applicationUrl && selected.applicationUrl !== selected.postingUrl && <a href={selected.postingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open posting details from ${selected.source} for ${selected.company} ${selected.roleTitle}`}>Posting details <ArrowUpRight size={15} /></a>}
          </div>
          {!selected.applicationUrl && <p className="link-note">Apply opens the available listing. A direct application link has not been confirmed; check the employer&apos;s career site before providing information.</p>}
          {isMultiOpportunityIndexUrl(selected.postingUrl) && <p className="link-note">This link is a multi-role discovery list, not a verified posting for this role. This record needs an individual posting check.</p>}
          {isSecondaryListing(selected.postingUrl) && <p className="link-note">Accepted secondary-source listing. Employer confirmation is not required to save or assess it; check current details before applying.</p>}
          <small>Last reviewed {displayDate(selected.lastVerified)} · Nothing is submitted by this Site.</small>
        </div>
      </SheetContent>}
    </Sheet>
  </>;
}
