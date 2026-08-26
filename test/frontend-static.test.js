import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../frontend/app/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../frontend/app/styles.css", import.meta.url), "utf8");
const javascript = await readFile(new URL("../frontend/app/app.js", import.meta.url), "utf8");

test("dashboard exposes separate Collect and immediate Update experiences", () => {
  assert.match(html, /Collect Opportunities/);
  assert.match(html, /Save and Update/);
  assert.match(html, /No Collect run is required/);
  assert.match(html, /Up to 3 searches · 15 candidates · top 3–5 updates/);
  assert.match(html, /nothing is submitted for you/);
  assert.match(html, /Daily automation/);
  assert.match(html, /Codex owns and manages it/);
  assert.match(html, /Copy setup prompt/);
  assert.match(html, /Duration/);
  assert.match(html, /Notification email/);
  assert.ok(html.indexOf("Notification email") < html.indexOf("Collect Opportunities"));
  assert.match(html, /Local files/);
  assert.match(javascript, /Update Opportunity/);
  assert.match(javascript, /Prepare materials/);
  assert.match(javascript, /Why this opportunity/);
  assert.match(html, /Checking Codex/);
  assert.match(html, /Verifying the local agent harness/);
  assert.match(javascript, /runtimeReady/);
  assert.match(javascript, /api\/settings\/notification/);
  assert.match(javascript, /api\/opportunities/);
  assert.match(javascript, /applicationUrl/);
  assert.match(javascript, /postingUrl/);
  assert.match(javascript, /formatDuration/);
  assert.match(javascript, /fitEvidence/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Information needed to continue/);
  assert.match(javascript, /api\/collect/);
  assert.match(javascript, /\/update/);
  assert.doesNotMatch(javascript, /Source ·/);
  assert.doesNotMatch(html, /<th[^>]*>Fit<\/th>/i);
});

test("dashboard includes semantic and reduced-motion accessibility foundations", () => {
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<section[^>]+aria-labelledby=/);
  assert.match(html, /<dialog/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});

test("dynamic content is inserted as text and never as executable HTML", () => {
  assert.doesNotMatch(javascript, /\.innerHTML\s*=/);
  assert.match(javascript, /\.textContent\s*=/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  assert.doesNotMatch(html, /<script(?![^>]*src=)/i);
});

test("frontend does not display reasoning or chain-of-thought fields", () => {
  assert.doesNotMatch(html, /chain[- ]of[- ]thought|private reasoning|scratch work/i);
  assert.doesNotMatch(javascript, /reasoning\/textDelta|reasoning\/summaryTextDelta/);
});

test("pixel agent has distinct observable animations for approved workflow states", () => {
  const stateAnimations = {
    RETRIEVING_PREFERENCES: "folder-work",
    SEARCHING_WEB: "scan",
    REVIEWING_CANDIDATES: "sort-cards",
    RANKING_OPPORTUNITIES: "sort-cards",
    ASSESSING_FIT: "sort-cards",
    ACTING: "folder-work",
    UPDATING_COLLECTION: "file-card",
    SENDING_NOTIFICATIONS: "send-envelope",
    VERIFYING: "pulse-check",
    REMEMBERING: "folder-work",
    FINISHED: "celebrate",
    NEEDS_ATTENTION: "pulse-check",
  };
  for (const [state, animation] of Object.entries(stateAnimations)) {
    assert.match(css, new RegExp(`data-state=["']${state}["'][^}]+${animation}`));
  }
  assert.match(css, /\.pixel-agent[^}]+idle-bob/);
  assert.match(css, /prefers-reduced-motion[\s\S]+animation-duration:\s*0\.01ms/);
});
