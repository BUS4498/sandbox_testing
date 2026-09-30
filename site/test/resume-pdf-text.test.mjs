import test from "node:test";
import assert from "node:assert/strict";
import { linesFromPdfTextItems } from "../lib/resume-pdf-text.js";

test("PDF extraction honors explicit line endings even when coordinates match", () => {
  const items = [
    { str: "EDUCATION", transform: [1, 0, 0, 1, 0, 100], hasEOL: true },
    { str: "Example University", transform: [1, 0, 0, 1, 0, 100], hasEOL: true },
    { str: "WORK", transform: [1, 0, 0, 1, 0, 95], hasEOL: false },
    { str: "EXPERIENCE", transform: [1, 0, 0, 1, 30, 95], hasEOL: true },
  ];
  assert.deepEqual(linesFromPdfTextItems(items), ["EDUCATION", "Example University", "WORK EXPERIENCE"]);
});
