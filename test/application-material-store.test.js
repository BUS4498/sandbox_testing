import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";

test("saves a verified review-only application template in private runtime storage", async () => {
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
    assert.match(saved.fileName, /\.docx$/);
    assert.equal(saved.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(saved.format, "DOCX");
    const material = await store.readMaterial("material-001");
    assert.equal(material.verified, true);
    assert.equal(material.bytes[0], 0x50);
    assert.equal(material.bytes[1], 0x4b);
    const [listed] = await store.listMaterials({ opportunityId: "opp-001" });
    assert.equal(listed.materialId, "material-001");
    assert.equal(listed.status, "DRAFT_REVIEW_REQUIRED");
    assert.equal("filePath" in listed, false);
    assert.equal((await readdir(path.join(directory, "application-materials", "opp-001"))).some((name) => name.endsWith(".md")), false);
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
