"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_ROLE_CHOICES } from "@/lib/hosted/profile-rules.js";
import { readResumeOnDevice } from "./resume-reader";
import type { StudentSetup } from "@/lib/hosted/store";
import type { RoleSuggestionResult } from "@/lib/hosted/role-suggestion-cache";
import { roleProfileFingerprint } from "@/lib/hosted/role-suggestion-rules.js";

type Preferences = {
  roles?: string[]; availableFrom?: string; availableThrough?: string; hoursPerWeek?: number;
  paidPreference?: string; relocationFlexibility?: string; workAuthorization?: string;
  workArrangements?: string[]; geographicBoundaries?: string; additionalConstraints?: string;
};

type Props = { setup: StudentSetup | null | undefined; disabled: boolean; preview?: boolean; onSaved: () => Promise<void> };

export default function StudentSetupCard(props: Props) {
  return <StudentSetupForm key={props.setup?.updatedAt ?? "not-loaded"} {...props} />;
}

function StudentSetupForm({ setup, disabled, preview = false, onSaved }: Props) {
  const preferences = (setup?.preferences ?? {}) as Preferences;
  const [profileText, setProfileText] = useState(setup?.profileText ?? "");
  const resumeInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [retainOriginal, setRetainOriginal] = useState(false);
  const [storedOriginal, setStoredOriginal] = useState("");
  const [roles, setRoles] = useState<string[]>(() => (preferences.roles ?? []).filter((role) => DEFAULT_ROLE_CHOICES.includes(role)));
  const [customRoles, setCustomRoles] = useState<string[]>(() => (preferences.roles ?? []).filter((role) => !DEFAULT_ROLE_CHOICES.includes(role)));
  const [roleDraft, setRoleDraft] = useState("");
  const [roleResult, setRoleResult] = useState<RoleSuggestionResult | null>(null);
  const [roleSuggestionConsent, setRoleSuggestionConsent] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleNotice, setRoleNotice] = useState("");
  const [roleError, setRoleError] = useState("");
  const [availableFrom, setAvailableFrom] = useState(preferences.availableFrom ?? "");
  const [availableThrough, setAvailableThrough] = useState(preferences.availableThrough ?? "");
  const [hoursPerWeek, setHoursPerWeek] = useState(preferences.hoursPerWeek ? String(preferences.hoursPerWeek) : "");
  const [paidPreference, setPaidPreference] = useState(preferences.paidPreference ?? "");
  const [relocationFlexibility, setRelocationFlexibility] = useState(preferences.relocationFlexibility ?? "");
  const [workAuthorization, setWorkAuthorization] = useState(preferences.workAuthorization ?? "");
  const [workArrangements, setWorkArrangements] = useState<string[]>(preferences.workArrangements ?? []);
  const [geographicBoundaries, setGeographicBoundaries] = useState(preferences.geographicBoundaries ?? "");
  const [additionalConstraints, setAdditionalConstraints] = useState(preferences.additionalConstraints ?? "");
  const [confirmedNoIdentifiers, setConfirmedNoIdentifiers] = useState(false);
  const [apiAssessmentConsent, setApiAssessmentConsent] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (preview) return;
    void fetch("/api/student-resume", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((value) => { const result = value as { stored?: boolean; fileName?: string } | null; setStoredOriginal(result?.stored ? result.fileName || "Stored privately" : ""); })
      .catch(() => undefined);
  }, [preview]);

  useEffect(() => {
    let current = true;
    setRoleResult(null); setRoleDraft(""); setRoleNotice(""); setRoleError("");
    if (!preview && confirmedNoIdentifiers && roleSuggestionConsent && profileText.trim().length >= 40) {
      void roleProfileFingerprint(profileText).then(fingerprint => fetch(`/api/role-suggestions?fingerprint=${fingerprint}`, { cache: "no-store" }))
        .then(response => response.ok ? response.json() : null)
        .then(value => { const saved = value as { result?: RoleSuggestionResult } | null; if (current && saved?.result) { setRoleResult(saved.result); setRoleNotice("Your saved suggestions for this resume are ready. No new AI request was used."); } })
        .catch(() => undefined);
    }
    return () => { current = false; };
  }, [profileText, confirmedNoIdentifiers, roleSuggestionConsent, preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const text = await readResumeOnDevice(file);
      setProfileText(text); setFileName(file.name); setSelectedFile(file);
      setConfirmedNoIdentifiers(false); setApiAssessmentConsent(false);
      setRoleSuggestionConsent(false);
      setNotice("Resume text extracted on this device. Review and remove identifiers from the agent-facing preview. You may separately approve private retention of the original file when saving.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The resume could not be read."); }
    finally { setBusy(false); }
  }

  async function send(body: Record<string, unknown>, success: string) {
    if (preview) { setNotice("Synthetic visual preview only. No setup was saved or changed."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Student setup could not be saved.");
      if (body.action === "SAVE_REAL" && selectedFile && retainOriginal) {
        const form = new FormData();
        form.set("resume", selectedFile);
        form.set("retainOriginal", "YES");
        const upload = await fetch("/api/student-resume", { method: "POST", body: form });
        const uploadResult = await upload.json() as { error?: string; fileName?: string };
        if (!upload.ok) { setNotice("The reviewed setup was saved, but the original resume was not retained."); throw new Error(uploadResult.error || "Private original-resume upload failed."); }
        setStoredOriginal(uploadResult.fileName || selectedFile.name);
        setSelectedFile(null);
      }
      if (body.action === "DELETE_REAL") { setStoredOriginal(""); setSelectedFile(null); }
      await onSaved();
      setNotice(success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Student setup could not be saved."); }
    finally { setBusy(false); }
  }

  async function deleteStoredOriginal() {
    if (!window.confirm("Delete the privately stored original resume? Your reviewed profile and past drafts will remain.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/student-resume", { method: "DELETE", headers: { "x-confirm-delete": "DELETE" } });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The original resume could not be deleted.");
      setStoredOriginal("");
      setNotice("The original resume was deleted and verified. Your reviewed profile remains active.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The original resume could not be deleted."); }
    finally { setBusy(false); }
  }

  function toggle(value: string, current: string[], update: (items: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function addRole() {
    const role = roleDraft.trim().replace(/\s+/g, " ");
    if (!roleResult?.suggestions.some(item => item.title === role)) { setRoleError("Choose a suggested role before selecting Add role."); return; }
    if ([...roles, ...customRoles].some((item) => item.toLocaleLowerCase() === role.toLocaleLowerCase())) {
      setError("That role is already in the list."); return;
    }
    const defaultRole = DEFAULT_ROLE_CHOICES.find(item => item.toLocaleLowerCase() === role.toLocaleLowerCase());
    if (defaultRole) setRoles(items => [...items, defaultRole]);
    else {
      if (customRoles.length >= 8) { setRoleError("You can add up to eight additional roles. Remove one before adding another."); return; }
      setCustomRoles((items) => [...items, role]);
    }
    setRoleDraft(""); setError(""); setRoleError("");
    setRoleNotice(`${role} added to your selections. Save your setup to use it for future searches.`);
  }

  async function suggestRoles() {
    setRoleBusy(true); setRoleError(""); setRoleNotice("Reading your reviewed resume to suggest role types. No web search is being performed.");
    try {
      if (preview) {
        setRoleResult({ suggestions: [
          { title: "Business Operations Analyst Intern", reason: "The synthetic resume describes process mapping and spreadsheet reporting.", evidence: [{ id: "R1", text: "Mapped a campus business process and summarized results using Excel." }] },
          { title: "Data Analytics Intern", reason: "The synthetic resume describes SQL analysis and a dashboard project.", evidence: [{ id: "R2", text: "Built a SQL-based reporting dashboard for an academic project." }] },
        ], profileFingerprint: await roleProfileFingerprint(profileText), createdAt: new Date().toISOString(), model: "Synthetic visual preview", version: "preview", cached: false });
        setRoleNotice("Synthetic examples only. No model request or saved preference change occurred."); return;
      }
      const response = await fetch("/api/role-suggestions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileText, confirmedNoIdentifiers, roleSuggestionConsent }) });
      const value = await response.json() as { result?: RoleSuggestionResult; error?: string; retryAt?: string };
      if (!response.ok || !value.result) throw new Error(`${value.error || "Suggestions could not be prepared."}${value.retryAt ? ` Try again after ${new Date(value.retryAt).toLocaleString()}.` : ""}`);
      if (value.result.profileFingerprint !== await roleProfileFingerprint(profileText)) throw new Error("The suggestions belong to a different resume preview. Request suggestions for your current resume.");
      setRoleResult(value.result); setRoleDraft("");
      setRoleNotice(value.result.suggestions.length ? value.result.cached ? "Saved suggestions reused. No new request or Collect allowance was used." : "Resume-based suggestions ready. Choose and add any roles you want; your preferences have not been saved yet." : "The resume did not support additional role suggestions. You can still select the default roles.");
    } catch (cause) { setRoleError(cause instanceof Error ? cause.message : "Suggestions could not be prepared. Your saved preferences were not changed."); setRoleNotice(""); }
    finally { setRoleBusy(false); }
  }

  function saveRealProfile() {
    if (roleDraft.trim()) { setError("Select Add role for your chosen suggestion, or clear the dropdown before saving."); return; }
    void send({ action: "SAVE_REAL", profileText, confirmedNoIdentifiers, apiAssessmentConsent, roles, customRoles, availableFrom, availableThrough, hoursPerWeek, paidPreference, relocationFlexibility, workAuthorization, workArrangements, geographicBoundaries, additionalConstraints }, "Real-student setup saved and verified. It is now active for future collection runs.");
  }

  const realSaved = Boolean(setup?.profileText && setup?.confirmedAt);
  const locked = busy || disabled || roleBusy;
  const selectedSuggestion = roleResult?.suggestions.find(item => item.title === roleDraft);
  const availableSuggestions = roleResult?.suggestions.filter(item => ![...roles, ...customRoles].some(role => role.toLowerCase() === item.title.toLowerCase())) ?? [];
  return <section className="student-setup" aria-labelledby="setup-title">
    <div className="section-head"><div><p className="eyebrow">STUDENT SETUP</p><h2 id="setup-title">Make the search yours</h2></div><div className="setup-side-controls"><span className={`setup-state ${setup?.ready ? "ready" : "incomplete"}`}>{setup?.mode === "REAL" && setup.ready ? "Real profile active" : setup?.mode === "SYNTHETIC_DEMONSTRATION" ? "Synthetic demo active" : "Setup incomplete"}</span><button type="button" className={setup?.mode === "SYNTHETIC_DEMONSTRATION" ? "demo-button selected" : "demo-button"} disabled={locked} title="Optional synthetic profile for classroom demonstration" onClick={() => void send({ action: "USE_DEMO" }, "Synthetic demonstration setup is active. Assessments will be labeled synthetic.")}>{setup?.mode === "SYNTHETIC_DEMONSTRATION" ? "Demo active" : "Try demo"}</button></div></div>
    <p className="setup-intro">Add a reviewed resume and choose the roles and constraints that guide your search.</p>
    {realSaved && setup?.mode !== "REAL" && <div className="setup-primary-choice"><button type="button" disabled={locked} onClick={() => void send({ action: "USE_REAL" }, "Confirmed real-student setup is active.")}>Use saved real profile</button></div>}
    <details className="setup-details" open={setup?.mode === "UNSELECTED" ? true : undefined}>
      <summary>{realSaved ? "Review or edit your real-student setup" : "Set up your real-student profile"}</summary>
      <fieldset className="setup-form" disabled={locked}>
        <p className="setup-privacy-note">The agent uses only the reviewed, non-identifying text you confirm here. With your separate approval, the original file may be retained privately for your own Word draft; that file is never sent to OpenAI or TypeSafe.</p>
        <div className="setup-step"><h3>1. Resume evidence</h3><p>Choose a .docx, .pdf, .md, or .txt resume up to 5 MB. Text extraction occurs in your browser. Remove your name, contact details, links, and any unnecessary sensitive information before saving.</p>
          <div className="file-picker"><input ref={resumeInput} type="file" accept=".docx,.pdf,.md,.txt" disabled={locked} className="resume-file-input" aria-label="Resume file" onChange={(event) => void handleFile(event.target.files?.[0])} /><button type="button" className="resume-choose-button" disabled={locked} onClick={() => resumeInput.current?.click()}>{fileName ? "Choose a different resume" : "Choose resume file"}</button><span>{fileName ? `Selected: ${fileName}` : "No file selected"}</span></div>
          <p className="setup-file-name">Your browser reads the file here. {storedOriginal ? `Original retained privately: ${storedOriginal}.` : "No original resume is currently retained."} PDF-to-Word drafts may preserve content without identical layout.</p>
          {storedOriginal && <div className="setup-actions"><a href="/api/student-resume?download=1">Download stored original</a><button type="button" className="resume-delete-button" disabled={locked} onClick={() => void deleteStoredOriginal()}>Delete stored original resume</button></div>}
          {selectedFile && <label className="setup-confirm"><input type="checkbox" checked={retainOriginal} onChange={(event) => setRetainOriginal(event.target.checked)} /> Retain this original resume privately in my account until I replace or delete it. Do not send the file to any model.</label>}
          <label className="setup-field">Agent-facing profile preview<textarea rows={9} maxLength={30_000} value={profileText} onChange={(event) => { setProfileText(event.target.value); setConfirmedNoIdentifiers(false); }} placeholder="Review and edit extracted education, skills, coursework, projects, and experience. Remove direct identifiers." /></label>
          <label className="setup-confirm"><input type="checkbox" checked={confirmedNoIdentifiers} onChange={(event) => setConfirmedNoIdentifiers(event.target.checked)} /> I reviewed the profile preview and removed my name, contact details, links, and unnecessary sensitive information.</label>
        </div>
        <div className="setup-step"><h3>2. Preferred internship roles</h3><p>Select the roles you want searched. These are preferences, not claimed qualifications.</p>
          <div className="setup-choice-grid">{DEFAULT_ROLE_CHOICES.map((role) => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role, roles, setRoles)} /> {role}</label>)}</div>
          <div className="role-suggestions">
            <h4>Explore roles that match your resume</h4><p>Get possible internship role types based on your coursework, skills, projects, and experience—not a list of available jobs.</p>
            <label className="setup-confirm"><input type="checkbox" checked={roleSuggestionConsent} onChange={event => setRoleSuggestionConsent(event.target.checked)} /> I allow OpenAI to read relevant, reviewed, non-identifying resume excerpts to suggest internship roles.</label>
            <div className="role-suggest-actions"><button type="button" disabled={locked || !confirmedNoIdentifiers || !roleSuggestionConsent || profileText.trim().length < 40} onClick={() => void suggestRoles()}>{roleBusy ? "Reading your resume…" : "Suggest roles from my resume"}</button><small>Up to 5 new requests per 24 hours. Saved suggestions are reused for free; no Collect allowance is used.</small></div>
            {(!confirmedNoIdentifiers || profileText.trim().length < 40) && <p className="role-help">Upload and review your resume in step 1 first. You do not need to finish availability settings to request suggestions.</p>}
            {roleNotice && <p className="setup-notice" role="status">{roleNotice}</p>}{roleError && <p className="setup-error" role="alert">{roleError}</p>}
            <label className="setup-field" htmlFor="suggested-role-select">Suggested internship role</label>
            <div className="role-add-row"><select id="suggested-role-select" value={roleDraft} disabled={locked || !availableSuggestions.length} onChange={event => setRoleDraft(event.target.value)}><option value="">{availableSuggestions.length ? "Choose a suggested role…" : roleResult ? "No additional suggestions available" : "Request suggestions first"}</option>{availableSuggestions.map(item => <option key={item.title} value={item.title}>{item.title}</option>)}</select><button type="button" disabled={locked || !roleDraft || (customRoles.length >= 8 && !DEFAULT_ROLE_CHOICES.includes(roleDraft))} onClick={addRole}>Add role</button></div>
            {selectedSuggestion && <div className="role-evidence"><strong>Why this role?</strong><p>{selectedSuggestion.reason}</p><span>From your reviewed resume</span><ul>{selectedSuggestion.evidence.map(item => <li key={item.id}>{item.text.replace(/^[•●▪‣*-]\s+/u, "")}</li>)}</ul><small>A suggestion is a starting point, not confirmation that you meet a particular employer’s requirements.</small></div>}
          </div>
          {customRoles.length > 0 && <ul className="custom-role-list" aria-label="Added preferred roles">{customRoles.map((role) => <li key={role}><span>{role}</span><button type="button" disabled={locked} aria-label={`Remove ${role}`} onClick={() => setCustomRoles((items) => items.filter((item) => item !== role))}>Remove</button></li>)}</ul>}
          <p className="role-limit">{customRoles.length} of 8 additional roles added. Select Add role for each one before saving.</p>
        </div>
        <div className="setup-step"><h3>3. Availability and constraints</h3><div className="setup-field-grid">
          <label className="setup-field">Available from<input type="date" value={availableFrom} onChange={(event) => setAvailableFrom(event.target.value)} /></label>
          <label className="setup-field">Available through<input type="date" value={availableThrough} onChange={(event) => setAvailableThrough(event.target.value)} /></label>
          <label className="setup-field">Hours per week<input type="number" min="1" max="80" value={hoursPerWeek} onChange={(event) => setHoursPerWeek(event.target.value)} /></label>
          <label className="setup-field">Paid internship preference<select value={paidPreference} onChange={(event) => setPaidPreference(event.target.value)}><option value="">Choose…</option><option value="REQUIRED">Paid required</option><option value="PREFERRED">Paid preferred</option><option value="NO_RESTRICTION">No restriction</option></select></label>
          <label className="setup-field">Relocation flexibility<select value={relocationFlexibility} onChange={(event) => setRelocationFlexibility(event.target.value)}><option value="">Choose…</option><option value="NO">No relocation</option><option value="CONDITIONAL">Depends on location or support</option><option value="YES">Open to relocation</option></select></label>
          <label className="setup-field">Work authorization / sponsorship<select value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)}><option value="">Choose…</option><option value="AUTHORIZED_NO_SPONSORSHIP">Authorized without sponsorship</option><option value="REQUIRES_SPONSORSHIP">Sponsorship required</option><option value="UNSURE_OR_PREFER_NOT_TO_STATE">Unsure or prefer not to state</option></select></label>
        </div><fieldset className="setup-arrangements"><legend>Acceptable work arrangements</legend>{[["HYBRID","Hybrid"],["REMOTE","Remote"],["ONSITE","Onsite"]].map(([value,label]) => <label key={value}><input type="checkbox" checked={workArrangements.includes(value)} onChange={() => toggle(value, workArrangements, setWorkArrangements)} /> {label}</label>)}</fieldset>
          <label className="setup-field">Geographic boundaries<textarea rows={2} maxLength={500} value={geographicBoundaries} onChange={(event) => setGeographicBoundaries(event.target.value)} placeholder="For example: California only" /></label>
          <label className="setup-field">Additional constraints<textarea rows={2} maxLength={1_000} value={additionalConstraints} onChange={(event) => setAdditionalConstraints(event.target.value)} placeholder="Optional scheduling or role constraints; avoid contact details" /></label>
        </div>
        <label className="setup-confirm"><input type="checkbox" checked={apiAssessmentConsent} onChange={(event) => setApiAssessmentConsent(event.target.checked)} /> I authorize this private Site to send relevant reviewed profile and preference information to the configured OpenAI API for internship fit assessment. Public web-search queries will use only broad role, location, timing, and work-arrangement criteria.</label>
        <div className="setup-actions"><button className="setup-save" type="button" disabled={locked} onClick={saveRealProfile}>{busy ? "Working…" : "Save and use real profile"}</button><span>Saved profile remains private to your signed-in Site account until you delete it.</span></div>
        {realSaved && <div className="setup-delete"><p>Delete the stored profile and preferences when you no longer want this Site to use them. Existing opportunity assessments are not erased by this action.</p><label>Type DELETE to remove the private profile <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label><button type="button" disabled={locked || deleteConfirmation !== "DELETE"} onClick={() => void send({ action: "DELETE_REAL", confirmation: deleteConfirmation }, "The stored profile and preferences were deleted. Choose a setup mode before collecting again.")}>Delete private profile</button></div>}
      </fieldset>
    </details>
    {error && <p role="alert" className="setup-error">{error}</p>}
    {notice && <p role="status" className="setup-notice">{notice}</p>}
  </section>;
}
