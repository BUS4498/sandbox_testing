"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { OpportunityRecord, StudentSetup } from "@/lib/hosted/store";
import type { MaterialRecord, MaterialType } from "@/lib/hosted/materials-store";
import { assessmentMatchesSetup, materialMatchesSetup } from "@/lib/hosted/opportunity-state.js";

const CHOICES: { type: MaterialType; label: string }[] = [
  { type: "TAILORED_RESUME", label: "Tailored resume with highlighted edits and change log" },
  { type: "COVER_LETTER_DRAFT", label: "Complete Cal Poly-inspired cover letter" },
  { type: "APPLICATION_QUESTION_WORKSHEET", label: "Application-question worksheet" },
];
const CURRENT_TYPES = new Set<MaterialType>(["TAILORED_RESUME", "COVER_LETTER_DRAFT", "APPLICATION_QUESTION_WORKSHEET"]);

type Props = {
  record: OpportunityRecord;
  materials: MaterialRecord[];
  activeMode: StudentSetup["mode"] | undefined;
  activeConfirmedAt: string | null | undefined;
  available: boolean;
  disabled: boolean;
  onPrepared: () => Promise<void>;
};

export default function MaterialsWorkspace({ record, materials, activeMode, activeConfirmedAt, available, disabled, onPrepared }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MaterialType[]>(["TAILORED_RESUME", "COVER_LETTER_DRAFT"]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const matchingProfile = assessmentMatchesSetup(record, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null });
  const visibleMaterials = matchingProfile ? materials.filter((material) => materialMatchesSetup(material, { mode: activeMode ?? "UNSELECTED", confirmedAt: activeConfirmedAt ?? null })) : [];
  const currentMaterials = visibleMaterials.filter((material) => CURRENT_TYPES.has(material.type));
  const earlierMaterials = visibleMaterials.filter((material) => !CURRENT_TYPES.has(material.type));

  function savedList(items: MaterialRecord[]) {
    return <ul>{items.map((material) => <li key={material.materialId}><span><b>{material.title}</b><small>Draft template — student review required · {new Date(material.createdAt).toLocaleDateString()}</small>{material.preparationNotice && <small>{material.preparationNotice}</small>}{material.opportunityVersion !== record.recordVersion || material.profileMode !== activeMode ? <small className="materials-warning">Prepared from an earlier opportunity or student setup. Recheck before use.</small> : null}{Boolean(material.tailoringChanges?.length) && <details className="materials-review-notes"><summary>What changed and why ({material.tailoringChanges!.length} edits)</summary><ol>{material.tailoringChanges!.map((change, index) => <li key={`${material.materialId}-edit-${index}`}><div><p><b>Original</b><br />{change.original}</p><p><b>Proposed</b><br />{change.proposed}</p><p><b>Job requirement</b><br />{change.requirement}</p><p><b>Why this edit</b><br />{change.rationale}</p></div></li>)}</ol></details>}{material.placeholders.length > 0 && <details className="materials-review-notes"><summary>{material.placeholders.length} review item{material.placeholders.length === 1 ? "" : "s"} to complete</summary><ul>{material.placeholders.map((note, index) => <li key={`${material.materialId}-note-${index}`}>{note}</li>)}</ul></details>}</span><a href={`/api/materials/${encodeURIComponent(material.materialId)}`} className="materials-download"><FileDown size={15} aria-hidden="true" /> Download Word draft</a></li>)}</ul>;
  }

  function toggle(type: MaterialType) {
    setSelected((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function prepare() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/materials/prepare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId: record.opportunityId, types: selected, requestId }) });
      const result = await response.json() as { error?: string; run?: { detail: string; status: string; summary?: { unresolvedIssues?: string[] } } };
      if (!response.ok && response.status !== 207) throw new Error(result.error || "The Word drafts could not be prepared.");
      await onPrepared();
      setMessage(result.run?.detail || "The Word draft request finished. Review the saved files below.");
      if (result.run?.status !== "SUCCESS" && result.run?.summary?.unresolvedIssues?.length) {
        setError(result.run.summary.unresolvedIssues.join(" "));
      }
      if (result.run?.status === "SUCCESS") setRequestId(crypto.randomUUID());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The Word drafts could not be prepared."); }
    finally { setBusy(false); }
  }

  return <section className="materials-workspace" aria-label={`Word application drafts for ${record.company} ${record.roleTitle}`}>
    <button type="button" className="materials-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Close materials" : "Prepare materials"}</button>
    {open && <div className="materials-panel">
      <p>Keep your original resume content and section order, with small job-specific edits highlighted in yellow. The Word draft and “What changed and why” notes compare each accepted edit with the original and the job requirement. Your uploaded file is not changed; PDF formatting is rebuilt in editable Word and may differ. If no safe edit is accepted, we say so. The cover letter uses a Cal Poly-inspired style. Add your contact details, verify every claim, and revise before use. Nothing is submitted or sent.</p>
      {!available && <p className="materials-warning">Private Word draft storage is not available yet.</p>}
      {!matchingProfile && <p className="materials-warning">This opportunity was assessed with a different student setup. Reassess it before preparing new drafts.</p>}
      <fieldset disabled={disabled || busy || !available || !matchingProfile}><legend>Draft types</legend>{CHOICES.map((choice) => <label key={choice.type}><input type="checkbox" checked={selected.includes(choice.type)} onChange={() => toggle(choice.type)} /> {choice.label}</label>)}</fieldset>
      <button type="button" className="materials-prepare" onClick={() => void prepare()} disabled={disabled || busy || !available || !matchingProfile || selected.length === 0}>{busy ? "Preparing Word drafts…" : `Prepare ${selected.length} Word draft${selected.length === 1 ? "" : "s"}`}</button>
      {error && <p className="materials-error" role="alert">{error}</p>}
      {message && <p className="materials-message" role="status">{message}</p>}
    </div>}
    {currentMaterials.length > 0 && <div className="materials-saved"><strong>Prepared application drafts</strong>{savedList(currentMaterials)}</div>}
    {earlierMaterials.length > 0 && <details className="materials-saved materials-earlier"><summary>Earlier planning files — checklists and outlines ({earlierMaterials.length})</summary>{savedList(earlierMaterials)}</details>}
  </section>;
}
