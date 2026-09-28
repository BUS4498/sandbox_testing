import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Document, Packer, Paragraph } from "docx";

import { DEFAULT_ROLE_CHOICES, LocalStudentProfileStore } from "../src/persistence/student-profile-store.js";

test("a private resume remains unconfirmed until the student reviews the non-identifying preview", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-test-"));
  try {
    const store = await new LocalStudentProfileStore({
      rootDir: root,
      clock: () => new Date("2026-09-26T12:00:00.000Z"),
      idFactory: () => "resume-test-id",
    }).initialize();
    const uploaded = await store.uploadResume({
      fileName: "Morgan Resume.txt",
      mediaType: "text/plain",
      bytes: Buffer.from("Morgan Rivera\nmorgan@example.edu · (805) 555-1212 · https://linkedin.com/in/morgan\nEDUCATION\nBSBA, Information Systems, expected May 2028\nSKILLS\nPython, SQL, Excel, Power BI\nEXPERIENCE\nImproved an Excel reconciliation workflow for a campus library.", "utf8"),
    });
    assert.equal(uploaded.status, "AWAITING_CONFIRMATION");
    assert.equal(uploaded.activeSource, "SETUP_INCOMPLETE");
    assert.equal(uploaded.readyForCollection, false);
    assert.doesNotMatch(uploaded.previewText, /Morgan Rivera|example\.edu|555-1212|linkedin/i);
    assert.match(uploaded.previewText, /Information Systems/);

    await assert.rejects(
      store.confirmProfile({ profileText: `${uploaded.previewText}\nmorgan@example.edu`, identifyingDetailsRemoved: true }),
      /email address/,
    );
    const confirmed = await store.confirmProfile({ profileText: uploaded.previewText, identifyingDetailsRemoved: true });
    assert.equal(confirmed.status, "SETUP_INCOMPLETE");
    assert.deepEqual(confirmed.missingItems, ["Save preferred roles, availability, and constraints"]);

    const ready = await store.savePreferencesAndConstraints(validStudentContext());
    assert.equal(ready.status, "REAL_STUDENT_READY");
    assert.equal(ready.activeSource, "PRIVATE_CONFIRMED");
    assert.equal(ready.readyForCollection, true);
    assert.deepEqual(ready.preferencesAndConstraints.preferredRoles, ["AI Business Analyst Intern"]);

    const syntheticPath = path.join(root, "synthetic.md");
    await writeFile(syntheticPath, "# Synthetic profile\n");
    const context = await store.activeResumeContext({ syntheticPath });
    assert.equal(context.sourceType, "PRIVATE_CONFIRMED");
    assert.match(context.content, /Python, SQL/);

    const deactivated = await store.deactivate();
    assert.equal(deactivated.status, "SETUP_INCOMPLETE");
    await assert.rejects(store.activeResumeContext({ syntheticPath }), /Choose real student setup or synthetic demonstration setup/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("synthetic demonstration context requires explicit activation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-demo-test-"));
  try {
    const store = await new LocalStudentProfileStore({ rootDir: root }).initialize();
    const initial = await store.snapshot();
    assert.equal(initial.readyForCollection, false);
    assert.deepEqual(initial.defaultRoleChoices, DEFAULT_ROLE_CHOICES);

    const syntheticResumePath = path.join(root, "resume.md");
    const syntheticPreferencesPath = path.join(root, "preferences.md");
    const syntheticConstraintsPath = path.join(root, "constraints.md");
    await Promise.all([
      writeFile(syntheticResumePath, "# Synthetic resume\n"),
      writeFile(syntheticPreferencesPath, "# Synthetic preferences\n"),
      writeFile(syntheticConstraintsPath, "# Synthetic constraints\n"),
    ]);
    const activated = await store.activateDemo();
    assert.equal(activated.readyForCollection, true);
    assert.equal(activated.activeSource, "SYNTHETIC_DEMONSTRATION");
    const context = await store.activeStudentContext({ syntheticResumePath, syntheticPreferencesPath, syntheticConstraintsPath });
    assert.equal(context.mode, "DEMO");
    assert.match(context.preferences, /Synthetic preferences/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preference and constraint validation preserves the prior confirmed record", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-context-test-"));
  try {
    const store = await new LocalStudentProfileStore({ rootDir: root, clock: () => new Date("2026-09-26T12:00:00.000Z") }).initialize();
    await store.savePreferencesAndConstraints(validStudentContext());
    await assert.rejects(store.savePreferencesAndConstraints({ ...validStudentContext(), preferredRoles: [], customRole: "" }), /Select at least one/);
    await assert.rejects(store.savePreferencesAndConstraints({ ...validStudentContext(), availabilityEnd: "2027-01-01" }), /end date/);
    await assert.rejects(store.savePreferencesAndConstraints({ ...validStudentContext(), additionalConstraints: "Email me at student@example.edu" }), /email address/);
    const snapshot = await store.snapshot();
    assert.deepEqual(snapshot.preferencesAndConstraints.preferredRoles, ["AI Business Analyst Intern"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DOCX resume text is extracted locally and the source file stays in private runtime storage", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-docx-test-"));
  try {
    const store = await new LocalStudentProfileStore({ rootDir: root, idFactory: () => "docx-test-id" }).initialize();
    const document = new Document({ sections: [{ children: [
      new Paragraph("Morgan Rivera"),
      new Paragraph("morgan@example.edu"),
      new Paragraph("EDUCATION"),
      new Paragraph("BSBA with an Information Systems concentration, expected May 2028"),
      new Paragraph("PROJECTS"),
      new Paragraph("Built a SQL and Power BI analysis using a synthetic retail dataset."),
    ] }] });
    const uploaded = await store.uploadResume({
      fileName: "resume.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: await Packer.toBuffer(document),
    });
    assert.match(uploaded.previewText, /Information Systems/);
    assert.match(uploaded.previewText, /Power BI/);
    assert.doesNotMatch(uploaded.previewText, /morgan@example\.edu/i);
    assert.equal(uploaded.pending.fileName, "resume.docx");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PDF resume text is extracted locally for student review", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-pdf-test-"));
  try {
    const store = await new LocalStudentProfileStore({ rootDir: root, idFactory: () => "pdf-test-id" }).initialize();
    const uploaded = await store.uploadResume({
      fileName: "resume.pdf",
      mediaType: "application/pdf",
      bytes: createSimplePdf("EDUCATION BSBA Information Systems SKILLS SQL Excel Power BI PROJECTS Dashboard analysis"),
    });
    assert.equal(uploaded.status, "AWAITING_CONFIRMATION");
    assert.match(uploaded.previewText, /Information Systems/);
    assert.match(uploaded.previewText, /Power BI/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("profile uploads reject unsupported, oversized, and binary text files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "student-profile-invalid-test-"));
  try {
    const store = await new LocalStudentProfileStore({ rootDir: root }).initialize();
    await assert.rejects(store.uploadResume({ fileName: "resume.exe", bytes: Buffer.from("content") }), /docx, .pdf, .md, or .txt/);
    await assert.rejects(store.uploadResume({ fileName: "resume.txt", bytes: Buffer.from([1, 0, 2]) }), /binary file/);
    await assert.rejects(store.uploadResume({ fileName: "resume.txt", bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 65) }), /5 MB or smaller/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function createSimplePdf(text) {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}

function validStudentContext() {
  return {
    preferredRoles: ["AI Business Analyst Intern"],
    customRole: "",
    availabilityStart: "2027-05-15",
    availabilityEnd: "2027-08-31",
    hoursPerWeek: 40,
    workArrangements: ["HYBRID", "REMOTE"],
    geographicLimits: "California or remote work performed from California",
    paidRequirement: "REQUIRED",
    relocation: "CONDITIONAL",
    workAuthorization: "UNSURE_OR_PREFER_NOT_TO_STATE",
    additionalConstraints: "No international relocation.",
    confirmed: true,
  };
}
