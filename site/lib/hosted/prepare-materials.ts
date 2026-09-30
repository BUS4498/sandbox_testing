import { appendEvent, finishRun, getOpportunity, getStudentSetup, startRun, updateRun, type RunRecord } from "./store";
import { saveWordMaterial, type MaterialRecord, type MaterialType } from "./materials-store";
import { draftMaterials } from "./material-drafting";
import { assessmentMatchesSetup } from "./opportunity-state.js";

export async function prepareMaterials(ownerId: string, opportunityId: string, types: MaterialType[], requestId: string): Promise<RunRecord> {
  const setup = await getStudentSetup(ownerId);
  if (!setup.ready) throw new TypeError("Confirm a student setup before preparing materials.");
  const record = await getOpportunity(ownerId, opportunityId);
  if (!record) throw new TypeError("This opportunity is no longer in your collection.");
  if (!assessmentMatchesSetup(record, setup)) throw new TypeError("Reassess this opportunity with the current student setup before preparing materials.");
  const run = await startRun(ownerId, "MATERIAL_PREP");
  const prepared: MaterialRecord[] = [];
  const issues: string[] = [];
  try {
    await appendEvent(ownerId, run.id, opportunityId, "RETRIEVE", { action: "MATERIAL_PREP", opportunityVersion: record.recordVersion, profileMode: setup.mode, requestedTypes: types });
    run.stage = "PREPARING_WORD_DRAFT"; run.progress = 25;
    run.detail = `Preparing ${types.length} review-only Word draft${types.length === 1 ? "" : "s"} for ${record.company} — ${record.roleTitle}; no application is submitted.`;
    await updateRun(ownerId, run);
    const needsDrafting = types.some((type) => type === "TAILORED_RESUME" || type === "COVER_LETTER_DRAFT");
    const drafted = needsDrafting ? await draftMaterials(record, setup, types) : undefined;
    const currentRecord = await getOpportunity(ownerId, opportunityId);
    const currentSetup = await getStudentSetup(ownerId);
    if (!currentRecord || currentRecord.recordVersion !== record.recordVersion || currentSetup.updatedAt !== setup.updatedAt || currentSetup.mode !== setup.mode) {
      throw new Error("The opportunity or student setup changed during drafting. Reopen it and prepare fresh drafts.");
    }
    for (const [index, type] of types.entries()) {
      const validationIssue = drafted?.validationIssues[type];
      if (validationIssue) {
        issues.push(`${type.replaceAll("_", " ")} was not saved: ${validationIssue}`);
      } else {
        try {
          const material = await saveWordMaterial(ownerId, record, type, requestId, drafted);
          prepared.push(material);
          try {
            await appendEvent(ownerId, run.id, opportunityId, "ACTION", { action: "WORD_DRAFT_SAVED", materialId: material.materialId, type, opportunityVersion: record.recordVersion });
            await appendEvent(ownerId, run.id, opportunityId, "EVALUATION", { materialId: material.materialId, expected: "Private readable Word draft tied to one opportunity", observed: "R2 bytes and D1 metadata passed read-back verification", outcome: "SUCCESS" });
          } catch { issues.push(`${type.replaceAll("_", " ")} was saved, but its activity history was incomplete.`); }
        } catch {
          issues.push(`${type.replaceAll("_", " ")} could not be saved or verified. Review the available drafts and try that type again.`);
        }
      }
      run.progress = Math.min(80, 25 + Math.round(55 * (index + 1) / types.length));
      run.detail = `Prepared ${prepared.length} of ${types.length} requested Word drafts for ${record.company} — ${record.roleTitle}; checking saved files.`;
      await updateRun(ownerId, run);
    }
    run.stage = "VERIFY"; run.progress = 90;
    run.detail = `Checking the private Word draft records for ${record.company} — ${record.roleTitle}.`;
    await updateRun(ownerId, run);
    await appendEvent(ownerId, run.id, opportunityId, "REMEMBER", { preparedMaterialIds: prepared.map((item) => item.materialId), unresolvedIssues: issues, nextAction: "Student reviews and edits any downloaded Word draft before use." });
    const reviewNotes = prepared.map((item) => drafted?.preparationNotices[item.type]).filter((item): item is string => Boolean(item));
    run.status = issues.length ? prepared.length ? "PARTIAL_SUCCESS" : "FAILURE" : "SUCCESS";
    run.stage = issues.length ? "ACTION_REQUIRED" : "FINISHED"; run.progress = 100;
    run.detail = prepared.length
      ? `${prepared.length} review-only Word draft${prepared.length === 1 ? "" : "s"} saved for ${record.company} — ${record.roleTitle}. Download and review before use; nothing was submitted or sent.${reviewNotes.length ? ` ${reviewNotes.join(" ")}` : ""}`
      : `No Word draft was verified for ${record.company} — ${record.roleTitle}. Review the issue and try again.`;
    run.summary = { runKind: "MATERIAL_PREP", opportunityId, requested: types.length, prepared: prepared.map((item) => ({ materialId: item.materialId, type: item.type, title: item.title })), unresolvedIssues: issues, reviewNotes, searchesPerformed: 0, emailSent: false };
    run.finishedAt = new Date().toISOString();
    await finishRun(ownerId, run);
    return run;
  } catch (error) {
    const safeReason = error instanceof Error && /^(The drafting|The resume selection|The cover-letter draft|The confirmed resume profile|The opportunity or student setup)/.test(error.message)
      ? error.message : "The preparation workflow did not complete. Review saved drafts and try again.";
    run.status = prepared.length ? "PARTIAL_SUCCESS" : "FAILURE";
    run.stage = "ACTION_REQUIRED"; run.progress = 100;
    run.detail = prepared.length ? `Some Word drafts were saved, but preparation stopped: ${safeReason}` : safeReason;
    run.summary = { runKind: "MATERIAL_PREP", opportunityId, requested: types.length, prepared: prepared.map((item) => ({ materialId: item.materialId, type: item.type, title: item.title })), unresolvedIssues: [safeReason], searchesPerformed: 0, emailSent: false };
    run.finishedAt = new Date().toISOString();
    await finishRun(ownerId, run).catch(() => undefined);
    return run;
  }
}
