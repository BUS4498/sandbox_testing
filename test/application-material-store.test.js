import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";

test("saves a verified review-only application template outside the repository", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-material-test-"));
  const store = await new LocalApplicationMaterialStore({
    rootDir: path.join(directory, "application-materials"),
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: () => "material-001",
  }).initialize();
  try {
    const saved = await store.saveTemplate({
      opportunityId: "opp-001",
      runId: "run-001",
      company: "Northstar Retail Analytics",
      roleTitle: "Information Systems Intern",
      type: "RESUME_TAILORING_CHECKLIST",
      title: "Resume tailoring checklist",
      markdown: "## Evidence to review\n\n- Verify SQL coursework.",
      placeholders: ["Confirm weekly availability"],
    });
    assert.equal(saved.verified, true);
    assert.match(saved.markdown, /^# Draft template — student review required/);
    assert.match(saved.markdown, /cannot submit|submit it yourself/i);
    const [listed] = await store.listMaterials({ opportunityId: "opp-001" });
    assert.equal(listed.materialId, "material-001");
    assert.equal(listed.status, "DRAFT_REVIEW_REQUIRED");
    assert.equal("filePath" in listed, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects unsupported template types and empty content", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-material-test-"));
  const store = await new LocalApplicationMaterialStore({ rootDir: directory }).initialize();
  try {
    await assert.rejects(store.saveTemplate({ opportunityId: "opp-001", type: "APPLICATION_SUBMISSION", title: "Submit", markdown: "Do it" }), /Unsupported/);
    await assert.rejects(store.saveTemplate({ opportunityId: "opp-001", type: "COVER_LETTER_OUTLINE", title: "Outline", markdown: "" }), /content is required/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
