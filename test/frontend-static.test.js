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
  assert.match(html, /Up to 10 searches · 15 candidates · top 3–5 updates/);
  assert.match(html, /nothing is submitted for you/);
  assert.match(html, /Daily collection/);
  assert.match(html, /works only while the local app is running/);
  assert.match(html, /Save schedule/);
  assert.match(html, /Duration/);
  assert.match(html, /Notification email/);
  assert.match(html, /STUDENT SETUP/i);
  assert.match(html, /Agent-facing profile preview/);
  assert.match(html, /Confirm and use profile/);
  assert.match(html, /AI Business Analyst Intern/);
  assert.match(html, /AI Systems Analyst Intern/);
  assert.match(html, /Business Process Automation Analyst Intern/);
  assert.match(html, /AI Product Analyst Intern/);
  assert.match(html, /Business Systems Analyst Intern/);
  assert.match(html, /Data or Business Intelligence Analyst Intern/);
  assert.match(html, /AI Transformation or Technology Consulting Intern/);
  assert.match(html, /Available from/);
  assert.match(html, /Work authorization \/ sponsorship/);
  assert.match(html, /Unsure or prefer not to state/);
  assert.match(html, /Use synthetic demonstration setup/);
  assert.ok(html.indexOf("STUDENT SETUP") < html.indexOf("Collect Opportunities"));
  assert.ok(html.indexOf("Notification email") < html.indexOf("Collect Opportunities"));
  assert.match(html, /Local files/);
  assert.match(javascript, /Update Opportunity/);
  assert.match(javascript, /Prepare materials/);
  assert.match(javascript, /Why this opportunity/);
  assert.match(html, /Checking OpenAI API configuration/);
  assert.match(html, /server-side key and model settings/);
  assert.match(html, /Check connection/);
  assert.match(javascript, /runtimeReady/);
  assert.match(javascript, /api\/settings\/notification/);
  assert.match(javascript, /api\/settings\/schedule/);
  assert.match(javascript, /api\/opportunities/);
  assert.match(javascript, /api\/profile\/resume/);
  assert.match(javascript, /api\/profile\/confirm/);
  assert.match(javascript, /api\/profile\/context/);
  assert.match(javascript, /api\/profile\/demo/);
  assert.match(javascript, /studentSetupReady/);
  assert.match(javascript, /collectionReady/);
  assert.match(javascript, /api\/runtime\/validate/);
  assert.match(javascript, /applicationUrl/);
  assert.match(javascript, /postingUrl/);
  assert.match(javascript, /formatDuration/);
  assert.match(javascript, /fitEvidence/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /Reset Collection/);
  assert.match(html, /Archive and Reset/);
  assert.match(javascript, /api\/reset/);
  assert.match(javascript, /Download Word draft/);
  assert.doesNotMatch(html, /id="update-needed-panel"/);
  assert.doesNotMatch(javascript, /Carrying out a permitted local action/);
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

test("frontend refreshes its local mutation token after a server restart", () => {
  assert.match(javascript, /if \(response\.status !== 403\) return response/);
  assert.match(javascript, /const currentToken = currentDashboard\?\.application\?\.requestToken/);
  assert.match(javascript, /if \(!currentToken \|\| currentToken === priorToken\) return response/);
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
    PREPARING_WORD_DRAFT: "file-card",
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
