import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AmbiguousDuplicateError,
  DuplicateOpportunityError,
  LocalSpreadsheetTracker,
  SpreadsheetConflictError,
} from "../src/persistence/spreadsheet-tracker.js";

const ARTIFACT_TOOL_MODULE =
  process.env.ARTIFACT_TOOL_MODULE_PATH ||
  path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
    "@oai",
    "artifact-tool",
  );

async function withTracker(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "internship-sheet-test-"));
  const tracker = new LocalSpreadsheetTracker({
    filePath: path.join(directory, "internship_pipeline.xlsx"),
    artifactToolModulePath: ARTIFACT_TOOL_MODULE,
    clock: () => new Date("2026-08-25T12:00:00.000Z"),
    idFactory: (() => {
      let counter = 0;
      return () => `test-${++counter}`;
    })(),
  });
  try {
    await tracker.initialize();
    await run(tracker, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function syntheticOpportunity(overrides = {}) {
  return {
    opportunityId: "opp-001",
    company: "Northstar Retail Analytics",
    roleTitle: "Information Systems Intern",
    location: "San Luis Obispo, CA",
    workArrangement: "Hybrid",
    internshipPeriod: "Summer 2027",
    deadline: "2026-10-15",
    source: "Employer career page",
    postingUrl: "https://example.edu/careers/opp-001?utm_source=course",
    applicationUrl: "https://apply.example.edu/jobs/opp-001",
    postingStatus: "ACTIVE",
    fitAssessment: "Strong",
    agentDecision: "PRIORITIZE",
    decisionRationale: "Verified coursework and project experience align with the stated requirements.",
    nextAction: "Review application materials",
    nextActionDate: "2026-09-01",
    lastVerified: "2026-08-25",
    lastAgentReview: "2026-08-25",
    ...overrides,
  };
}

test("creates a readable collection and removes temporary workbook artifacts", async () => {
  await withTracker(async (tracker, directory) => {
    const added = await tracker.addOpportunity(syntheticOpportunity());
    assert.equal(added.verification.success, true);

    const records = await tracker.readRecords();
    assert.equal(records.length, 1);
    assert.equal(records[0].company, "Northstar Retail Analytics");
    assert.equal(records[0].recordVersion, 1);
    assert.equal(records[0].deadline, "2026-10-15");
    assert.equal(records[0].applicationUrl, "https://apply.example.edu/jobs/opp-001");

    const runtimeFiles = await readdir(directory);
    assert.deepEqual(runtimeFiles, ["internship_pipeline.xlsx"]);
  });
});

test("deduplicates canonical URLs before adding a second row", async () => {
  await withTracker(async (tracker) => {
    await tracker.addOpportunity(syntheticOpportunity());
    await assert.rejects(
      tracker.addOpportunity(
        syntheticOpportunity({
          opportunityId: "opp-002",
          postingUrl: "https://EXAMPLE.edu/careers/opp-001?utm_campaign=repeat#apply",
        }),
      ),
      DuplicateOpportunityError,
    );
    assert.equal((await tracker.readRecords()).length, 1);
  });
});

test("flags incomplete company-and-role matches for human review", async () => {
  await withTracker(async (tracker) => {
    await tracker.addOpportunity(syntheticOpportunity());
    await assert.rejects(
      tracker.addOpportunity(
        syntheticOpportunity({
          opportunityId: "opp-003",
          postingUrl: "https://example.edu/careers/opp-003",
          location: "",
          internshipPeriod: "",
        }),
      ),
      AmbiguousDuplicateError,
    );
  });
});

test("updates material fields with optimistic versions and read-back verification", async () => {
  await withTracker(async (tracker) => {
    await tracker.addOpportunity(syntheticOpportunity());
    const result = await tracker.updateOpportunity(
      "opp-001",
      { deadline: "2026-09-30", postingStatus: "ACTIVE" },
      { expectedVersion: 1 },
    );
    assert.equal(result.materialChange, true);
    assert.deepEqual(result.changedFields, ["deadline"]);
    assert.equal(result.record.recordVersion, 2);
    assert.equal(result.verification.success, true);

    await assert.rejects(
      tracker.updateOpportunity("opp-001", { location: "Remote" }, { expectedVersion: 1 }),
      SpreadsheetConflictError,
    );
  });
});

test("the agent cannot overwrite student-owned status, notes, or overrides", async () => {
  await withTracker(async (tracker) => {
    await tracker.addOpportunity(syntheticOpportunity());
    await tracker.updateOpportunity(
      "opp-001",
      { applicationStatus: "PREPARING", studentNotes: "Ask faculty mentor to review.", nextAction: "Revise resume" },
      { actor: "STUDENT", expectedVersion: 1 },
    );

    await assert.rejects(
      tracker.updateOpportunity("opp-001", { applicationStatus: "SUBMITTED" }, { actor: "AGENT", expectedVersion: 2 }),
      /student-owned field/,
    );
    await assert.rejects(
      tracker.updateOpportunity("opp-001", { nextAction: "Apply immediately" }, { actor: "AGENT", expectedVersion: 2 }),
      /student-owned next action/,
    );
  });
});

test("spreadsheet text that resembles a formula is stored as inert text", async () => {
  await withTracker(async (tracker) => {
    await tracker.addOpportunity(syntheticOpportunity({ company: "=HYPERLINK(\"https://bad.example\")" }));
    const [record] = await tracker.readRecords();
    assert.equal(record.company, "=HYPERLINK(\"https://bad.example\")");
  });
});
