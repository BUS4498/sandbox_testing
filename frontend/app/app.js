const $ = (selector) => document.querySelector(selector);
const elements = {
  runButton: $("#collect-opportunities"), agent: $("#pixel-agent"), agentStatus: $("#agent-status"), agentDetail: $("#agent-detail"),
  progress: $("#workflow-progress"), progressFill: $("#workflow-progress-fill"), progressPercent: $("#workflow-progress-percent"),
  search: $("#collection-search"), decisionFilter: $("#decision-filter"), collectionList: $("#collection-list"),
  collectionEmpty: $("#collection-empty"), selectedSection: $("#selected-section"), selectedList: $("#selected-list"),
  activityList: $("#activity-list"), activityEmpty: $("#activity-empty"), approvalDialog: $("#approval-dialog"),
  responseDialog: $("#response-dialog"), responseForm: $("#response-form"), toast: $("#toast"),
  runtimeReadiness: $("#runtime-readiness"), runtimeRecheck: $("#runtime-recheck"),
  notificationForm: $("#notification-settings-form"), notificationEmail: $("#notification-email"),
  updateNeededPanel: $("#update-needed-panel"), updateNeededList: $("#update-needed-list"),
};

let dashboard = null;
let requestToken = null;
let activeApproval = null;
let activeOpportunity = null;
let runTimer = null;
let displayedRun = null;

const DAILY_AUTOMATION_PROMPT = `Create a daily scheduled task in this internship-agent task at my chosen local time.

Collect internship opportunities with the Internship Application Prep Agent. Follow AGENTS.md, agent/agent.md, and the relevant specifications. Use no more than 3 targeted searches, collect no more than 15 candidates, and select the top 3 to 5 relevant new or materially changed opportunities when at least 3 qualify. If fewer than 3 qualify, record the reason. Update the spreadsheet, send permitted Outlook notifications, verify outcomes, update memory, save the run summary, and stop. Never submit applications.`;

elements.runButton.addEventListener("click", startCollection);
elements.search.addEventListener("input", renderCollection);
elements.decisionFilter.addEventListener("change", renderCollection);
elements.runtimeRecheck.addEventListener("click", recheckRuntime);
elements.notificationForm.addEventListener("submit", saveNotificationEmail);
elements.responseForm.addEventListener("submit", saveStudentResponse);
elements.responseForm.addEventListener("change", updateResponseFields);
elements.collectionList.addEventListener("click", handleOpportunityAction);
elements.selectedList.addEventListener("click", handleOpportunityAction);
elements.updateNeededList.addEventListener("click", handleOpportunityAction);
$("#copy-spreadsheet-path").addEventListener("click", () => copyText(dashboard?.sync?.spreadsheetPath, "Spreadsheet path copied."));
$("#copy-schedule-prompt").addEventListener("click", () => copyText(DAILY_AUTOMATION_PROMPT, "Daily automation setup prompt copied."));
$("#approval-accept").addEventListener("click", () => resolveApproval(activeApproval?.questions?.length ? "respond" : "accept"));
$("#approval-decline").addEventListener("click", () => resolveApproval(activeApproval?.questions?.length ? "cancel" : "decline"));
document.addEventListener("click", (event) => {
  const close = event.target.closest("[data-close]");
  if (!close) return;
  if (close.dataset.close === "approval-dialog" && activeApproval) resolveApproval("cancel");
  else document.getElementById(close.dataset.close)?.close();
});

await refreshDashboard();
connectEventStream();

async function refreshDashboard() {
  try {
    const response = await fetch("/api/dashboard", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Dashboard data is unavailable.");
    dashboard = await response.json();
    requestToken = dashboard.application.requestToken;
    renderDashboard();
  } catch {
    updateAgent("NEEDS_ATTENTION", "Dashboard unavailable", "The local dashboard could not load current data. Restart the local application, then refresh this page.", 0);
    setText("#notification-config-status", "Check failed");
    setText("#notification-settings-detail", "The Outlook connection could not be checked. Restart the local application, then refresh this page.");
    $("#outlook-dot").dataset.status = "UNKNOWN";
    elements.runButton.disabled = true;
  }
}

function connectEventStream() {
  const events = new EventSource("/api/events");
  events.onmessage = async ({ data }) => {
    let event;
    try { event = JSON.parse(data); } catch { return; }
    if (event.type === "run.stage") {
      updateAgent(event.stage, event.label, event.detail, event.progressPercent);
      setRunButton(true, "Workflow active");
    }
    if (event.type === "run.started") {
      renderRun(event.run);
      setRunButton(true, "Workflow active");
    }
    if (event.type === "run.completed") {
      await refreshDashboard();
      setRunButton(!runtimeReady(), "Collect Opportunities");
      showToast(event.run.outcome === "SUCCESS" ? "Workflow finished and verified." : "Workflow finished. Review the specific action shown on the dashboard.");
    }
    if (event.type === "approval.requested") showApproval(event.approval);
    if (event.type === "approval.resolved") {
      activeApproval = null;
      elements.approvalDialog.close();
      showToast("Your approval response was recorded.");
    }
  };
  events.onerror = () => {
    if (!dashboard?.run?.active) updateAgent("NEEDS_ATTENTION", "Progress connection interrupted", "Live progress is temporarily disconnected. Your saved local data is unaffected.", dashboard?.run?.progressPercent || 0);
  };
}

async function startCollection() {
  if (!runtimeReady()) return showToast("Codex must be ready before collection can start.");
  setRunButton(true, "Starting…");
  updateAgent("RETRIEVING_PREFERENCES", "Reading your search preferences", "Reviewing your verified roles, locations, timing, and current collection before searching.", 6);
  try {
    const response = await localFetch("/api/collect", {});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Collection could not start.");
    renderRun(body.run);
  } catch (error) {
    setRunButton(false, "Collect Opportunities");
    updateAgent("NEEDS_ATTENTION", "Collection could not start", error.message, 0);
    showToast(error.message);
  }
}

function renderDashboard() {
  setText("#metric-total", dashboard.metrics.totalTracked);
  setText("#metric-new", dashboard.metrics.newlyAdded);
  setText("#metric-prioritize", dashboard.metrics.prioritize);
  setText("#metric-deadlines", dashboard.metrics.approachingDeadlines);
  setText("#metric-attention", dashboard.metrics.needsAttention);
  renderRuntime(); renderNotificationSettings(); renderCollection(); renderAttention(); renderRun(dashboard.run); renderSync();
  renderAutomation(); renderSelected(); renderActivity(); renderNotification();
  if (dashboard.pendingApprovals?.length) showApproval(dashboard.pendingApprovals[0]);
}

function renderRuntime() {
  const runtime = dashboard?.runtime ?? {};
  elements.runtimeReadiness.dataset.status = display(runtime.status);
  setText("#runtime-label", runtime.label || "Codex readiness unknown");
  setText("#runtime-authentication", runtime.authentication || "Authentication status unknown");
  setText("#runtime-detail", runtime.detail || "Recheck the local agent harness before starting a run.");
  elements.runtimeRecheck.textContent = runtime.status === "READY" ? "Check again" : "Recheck";
}

async function recheckRuntime() {
  elements.runtimeRecheck.disabled = true;
  elements.runtimeRecheck.textContent = "Checking…";
  try { await refreshDashboard(); showToast(runtimeReady() ? "Codex is ready." : "Codex still needs attention."); }
  finally { elements.runtimeRecheck.disabled = false; }
}

function renderCollection() {
  if (!dashboard) return;
  const query = elements.search.value.trim().toLowerCase();
  const decision = elements.decisionFilter.value;
  const records = dashboard.collection.filter((record) => {
    const matchesText = !query || `${record.company} ${record.roleTitle}`.toLowerCase().includes(query);
    return matchesText && (!decision || record.agentDecision === decision);
  });
  elements.collectionList.replaceChildren(...records.map(opportunityCard));
  elements.collectionEmpty.hidden = records.length > 0;
}

function opportunityCard(record) {
  const card = make("article", "opportunity-card");
  card.dataset.opportunityId = record.opportunityId;
  const header = make("header", "opportunity-header");
  const identity = make("div");
  identity.append(makeText("span", record.company, "company-name"), makeText("h3", record.roleTitle));
  const decision = makeText("span", display(record.agentDecision), `decision-badge ${decisionClass(record.agentDecision)}`);
  header.append(identity, decision);
  const meta = make("div", "opportunity-meta");
  for (const value of [joinKnown(record.location, record.workArrangement), deadlineLabel(record.deadline), display(record.postingStatus)]) meta.append(makeText("span", value));

  const rationale = make("section", "recommendation-panel");
  rationale.append(makeText("span", record.fitAssessment === "INSUFFICIENT INFORMATION" ? "Needs clarification" : "Why this opportunity"), makeText("p", display(record.decisionRationale)));
  const action = make("section", "next-action-panel");
  action.append(makeText("span", "NEXT ACTION"), makeText("strong", display(record.nextAction)));
  if (record.nextActionRequest?.prompt) action.append(makeText("p", record.nextActionRequest.prompt));
  if (record.unresolvedIssue) action.append(makeText("p", `Needs attention: ${record.unresolvedIssue}`, "attention-copy"));
  if (record.studentInput) action.append(makeText("small", studentInputLabel(record.studentInput), "student-input-status"));

  const evidence = evidenceDisclosure(record);
  const materials = materialList(record.materials);
  const actions = make("footer", "opportunity-actions");
  appendLink(actions, record.applicationUrl, "Apply", "button-link primary-link", "Open the employer application page");
  appendLink(actions, record.postingUrl, "Source", "button-link source-link", record.source ? `Source: ${record.source}` : "Open the original posting source");
  actions.append(actionButton("Update Opportunity", "respond"), actionButton("Prepare materials", "prepare"));
  card.append(header, meta, rationale, action, evidence, materials, actions);
  return card;
}

function renderAttention() {
  const items = dashboard?.attentionItems || [];
  elements.updateNeededPanel.hidden = items.length === 0;
  setText("#update-needed-count", items.length);
  elements.updateNeededList.replaceChildren(...items.map((item) => {
    const row = make("article", "update-needed-item");
    row.dataset.opportunityId = item.opportunityId;
    const copy = make("div");
    copy.append(
      makeText("strong", `${item.company} — ${item.roleTitle}`),
      makeText("p", item.prompt),
    );
    const button = actionButton(item.actionLabel || "Update Opportunity", "respond");
    button.classList.add("attention-update-button");
    button.disabled = Boolean(dashboard?.run?.active);
    row.append(copy, button);
    return row;
  }));
}

function evidenceDisclosure(record) {
  const details = make("details", "evidence-disclosure");
  details.append(makeText("summary", record.fitAssessment === "INSUFFICIENT INFORMATION" ? "See missing information" : "See evidence and gaps"));
  const evidence = record.fitEvidence ?? {};
  details.append(evidenceGroup("Verified matches", [...(evidence.requiredMatches || []), ...(evidence.preferredMatches || [])]), evidenceGroup("Preference alignment", evidence.preferenceAlignment || []), evidenceGroup("Genuine gaps", evidence.gaps || []), evidenceGroup("Clarifications needed", evidence.unknowns || []));
  return details;
}

function evidenceGroup(title, items) {
  const section = make("section");
  section.append(makeText("strong", title));
  const list = make("ul");
  (items.length ? items : ["None recorded."]).forEach((item) => list.append(makeText("li", item)));
  section.append(list);
  return section;
}

function materialList(materials = []) {
  const section = make("section", "material-list");
  if (materials.length === 0) { section.hidden = true; return section; }
  section.append(makeText("strong", "Prepared drafts"));
  for (const material of materials) {
    const link = makeText("a", `${materialTitle(material.type)} · student review required`);
    link.href = `/api/materials/${encodeURIComponent(material.materialId)}`;
    link.className = "material-link";
    section.append(link);
  }
  return section;
}

function renderRun(run) {
  const summary = run?.summary ?? {};
  for (const [id, value] of Object.entries({ searches: summary.searchesPerformed, discovered: summary.candidatesDiscovered, excluded: summary.duplicatesOrInvalid, ranked: summary.candidatesRanked, selected: summary.updatesSelected, added: summary.newOpportunitiesAdded, updated: summary.existingOpportunitiesUpdated, notifications: summary.notificationsSent, unresolved: summary.unresolvedIssues })) setText(`#summary-${id}`, displayNumber(value));
  displayedRun = run ?? null;
  updateRunDuration(); window.clearInterval(runTimer); runTimer = run?.active ? window.setInterval(updateRunDuration, 1_000) : null;
  const pill = $("#run-outcome");
  pill.textContent = run?.active ? "Running" : run?.outcome ? titleCase(run.outcome) : "Not run";
  pill.className = `status-pill ${run?.active ? "active" : run?.outcome === "SUCCESS" ? "success" : run?.outcome ? "failure" : "neutral"}`;
  setText("#summary-title", run?.workflowType === "UPDATE" ? "Opportunity update" : "Today’s collection");
  const firstRun = run?.active && run?.firstRun ? " First run can take longer while Codex initializes the approved thread." : "";
  const shortfall = summary.selectionShortfallReason ? ` Fewer than three were selected: ${summary.selectionShortfallReason}` : "";
  const workflowContext = run?.workflowType === "UPDATE"
    ? `Targeted update for ${run.targetLabel || "one opportunity"}. No web search is performed.`
    : `Discovery counts appear as the bounded collection workflow runs.${firstRun}`;
  setText("#run-message", run?.error?.message || (run?.finishedAt ? `${run.statusDetail || "Workflow finished."} Completed ${formatDateTime(run.finishedAt)} in ${formatDuration(run.durationMs)}.${shortfall}` : workflowContext));
  const stage = run?.stage || "WAITING";
  const informationNeeded = !run?.active && stage === "NEEDS_ATTENTION" && (dashboard?.attentionItems?.length || 0) > 0;
  const statusLabel = informationNeeded ? "Information needed to continue" : run?.label === "Needs Attention" ? "Action required" : run?.label || "Waiting";
  const detail = informationNeeded
    ? `${dashboard.attentionItems.length} ${dashboard.attentionItems.length === 1 ? "opportunity needs" : "opportunities need"} information from you. Select Update Opportunity beside the relevant item to continue it immediately.`
    : run?.statusDetail || (run?.active ? "The approved workflow is running locally through Codex." : run?.outcome === "SUCCESS" ? "The latest workflow completed and was verified." : run?.outcome ? "Review the specific update request shown below." : "Ready to collect opportunities or update an existing one.");
  updateAgent(stage, statusLabel, detail, run?.progressPercent ?? (run?.finishedAt ? 100 : 0));
  setRunButton(Boolean(run?.active) || !runtimeReady(), run?.active ? "Workflow active" : "Collect Opportunities");
}

function renderSelected() {
  const selected = dashboard.selectedOpportunities || [];
  elements.selectedSection.hidden = selected.length === 0;
  elements.selectedList.replaceChildren(...selected.map((record) => {
    const card = make("article", "selected-card"); card.dataset.opportunityId = record.opportunityId;
    card.append(makeText("span", display(record.updateDisposition), "update-tag"), makeText("h3", `${record.company} — ${record.roleTitle}`), makeText("p", joinKnown(record.location, record.workArrangement, deadlineLabel(record.deadline))), makeText("p", display(record.decisionRationale || record.selectionEvidence), "selection-reason"), makeText("small", `Outcome: ${titleCase(record.processingOutcome)}`));
    const links = make("div", "selected-links"); appendLink(links, record.applicationUrl, "Apply", "text-link", "Open the employer application page"); appendLink(links, record.postingUrl, "Source", "text-link", record.source ? `Source: ${record.source}` : "Open the original posting source"); card.append(links);
    return card;
  }));
}

function renderSync() {
  setText("#sync-label", dashboard.sync.label); setText("#sync-count", `${dashboard.sync.trackedOpportunities} ${dashboard.sync.trackedOpportunities === 1 ? "opportunity" : "opportunities"}`);
  setText("#sync-time", dashboard.sync.lastSuccessfulUpdate ? `Updated ${formatDateTime(dashboard.sync.lastSuccessfulUpdate)}` : "No verified update yet");
  $("#sync-dot").classList.toggle("available", dashboard.sync.status === "AVAILABLE"); setText("#spreadsheet-path", dashboard.sync.spreadsheetPath || "Local spreadsheet path unavailable");
  setText("#storage-availability", dashboard.sync.status === "AVAILABLE" ? "Spreadsheet available on this device. Prepared drafts are stored beside other private runtime data." : "The spreadsheet will be created after the first verified opportunity update.");
}

function renderAutomation() {
  setText("#automation-status", display(dashboard.automation.status)); setText("#automation-schedule", display(dashboard.automation.schedule)); setText("#automation-timezone", display(dashboard.automation.timezone)); setText("#automation-last", formatMaybeDate(dashboard.automation.lastRun)); setText("#automation-next", formatMaybeDate(dashboard.automation.nextRun));
}

function renderActivity() {
  const activity = dashboard.activity || []; elements.activityEmpty.hidden = activity.length > 0;
  elements.activityList.replaceChildren(...activity.map((entry) => { const item = make("li"); item.append(make("span", `activity-marker${entry.attentionRequired ? " attention" : ""}`), makeText("div", entry.label, "activity-copy"), makeText("span", titleCase(entry.outcome), "activity-outcome")); item.querySelector(".activity-copy").append(makeText("small", `${entry.opportunityId || "Run-level"} · ${formatDateTime(entry.timestamp)}`)); return item; }));
}

function renderNotification() { const notification = dashboard.notification; setText("#email-status", notification ? `Email: ${titleCase(notification.status)}` : "No email yet"); }

function renderNotificationSettings() {
  const settings = dashboard.notificationSettings ?? {}; const outlook = settings.outlook ?? {};
  const status = $("#notification-config-status"); status.textContent = settings.configured ? "Address saved" : "Add address"; status.className = `status-pill ${settings.configured ? "success" : "neutral"}`;
  elements.notificationEmail.value = ""; elements.notificationEmail.placeholder = settings.recipientHint || "student@example.edu";
  $("#outlook-dot").dataset.status = outlook.status || settings.deliveryStatus || "UNKNOWN";
  setText("#notification-settings-detail", `${outlook.label || "Outlook status unknown"}. ${settings.explanation || "The address stays in local settings."}`);
}

async function saveNotificationEmail(event) {
  event.preventDefault(); const button = elements.notificationForm.querySelector("button[type='submit']"); button.disabled = true; button.textContent = "Saving…";
  try { const response = await localFetch("/api/settings/notification", { email: elements.notificationEmail.value.trim() }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "The address could not be saved."); await refreshDashboard(); showToast(body.settings.deliveryStatus === "CONNECTED" ? "Address saved. Outlook notifications are ready." : "Address saved locally. Review the Outlook connection status above."); }
  catch (error) { showToast(error.message); } finally { button.disabled = false; button.textContent = "Save"; }
}

function handleOpportunityAction(event) {
  const button = event.target.closest("button[data-action]"); if (!button) return;
  if (dashboard?.run?.active) return showToast("Wait for the active workflow to finish before starting another update.");
  const opportunityId = button.closest("[data-opportunity-id]")?.dataset.opportunityId;
  const record = dashboard.collection.find((item) => item.opportunityId === opportunityId);
  if (record) openResponse(record, button.dataset.action === "prepare");
}

function openResponse(record, prepare = false) {
  activeOpportunity = record; elements.responseForm.reset();
  const type = prepare ? "REQUEST_APPLICATION_MATERIALS" : record.nextActionRequest?.responseType === "CONFIRMATION" ? "CONFIRM_COMPLETED" : "PROVIDE_INFORMATION";
  const radio = elements.responseForm.querySelector(`[name='responseType'][value='${type}']`); if (radio) radio.checked = true;
  setText("#response-title", `${record.company} — ${record.roleTitle}`); setText("#response-context", record.nextActionRequest?.prompt || record.nextAction || "Tell the agent what changed or request preparation help.");
  setText("#response-next-step", "Your response will be saved locally, then the agent will immediately process this opportunity only. It will not collect new opportunities.");
  updateResponseFields(); elements.responseDialog.showModal();
}

function updateResponseFields() {
  const type = elements.responseForm.elements.responseType?.value; $("#response-text-wrap").hidden = type !== "PROVIDE_INFORMATION"; $("#template-options").hidden = type !== "REQUEST_APPLICATION_MATERIALS";
}

async function saveStudentResponse(event) {
  event.preventDefault(); if (!activeOpportunity) return;
  const type = elements.responseForm.elements.responseType.value; const templateTypes = [...$("#template-options").querySelectorAll("input:checked")].map((input) => input.value);
  const button = $("#response-submit"); button.disabled = true; button.textContent = "Starting update…";
  try {
    const response = await localFetch(`/api/opportunities/${encodeURIComponent(activeOpportunity.opportunityId)}/update`, { type, text: $("#response-text").value, templateTypes });
    const body = await response.json();
    if (!response.ok && body.responseSaved) {
      elements.responseDialog.close();
      await refreshDashboard();
      showToast(body.error);
      return;
    }
    if (!response.ok) throw new Error(body.error || "Your opportunity update could not start.");
    elements.responseDialog.close();
    renderRun(body.run);
    await refreshDashboard();
    showToast("Your information was saved and the targeted opportunity update started.");
  }
  catch (error) { showToast(error.message); } finally { button.disabled = false; button.textContent = "Save and Update"; }
}

function showApproval(approval) {
  if (!approval || activeApproval?.approvalId === approval.approvalId) return; activeApproval = approval;
  setText("#approval-title", approval.title); setText("#approval-reason", approval.reason); setText("#approval-action", Array.isArray(approval.command) ? approval.command.join(" ") : display(approval.command)); setText("#approval-location", display(approval.cwd));
  const questions = $("#approval-questions"); questions.replaceChildren(...(approval.questions || []).map((question) => { const fieldset = make("fieldset", "approval-question"); fieldset.append(makeText("legend", question.question)); for (const [index, option] of question.options.entries()) { const label = make("label"); const input = document.createElement("input"); input.type = "radio"; input.name = `question-${question.id}`; input.value = option.label; input.required = true; if (index === 0) input.checked = true; label.append(input, document.createTextNode(` ${option.label} — ${option.description}`)); fieldset.append(label); } return fieldset; }));
  $("#approval-details").hidden = Boolean(approval.questions?.length); $("#approval-accept").textContent = approval.questions?.length ? "Continue" : "Approve once"; $("#approval-decline").textContent = approval.questions?.length ? "Cancel" : "Decline"; elements.approvalDialog.showModal();
}

async function resolveApproval(decision) {
  if (!activeApproval) return; const answers = {};
  for (const question of activeApproval.questions || []) { const selected = document.querySelector(`[name='question-${CSS.escape(question.id)}']:checked`); if (selected) answers[question.id] = [selected.value]; }
  try { const response = await localFetch(`/api/approvals/${encodeURIComponent(activeApproval.approvalId)}`, { decision, answers }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Approval response failed."); }
  catch (error) { showToast(error.message); }
}

function updateAgent(stage, label, detail, progressPercent = 0) {
  const approved = /^[A-Z_]+$/.test(stage) ? stage : "NEEDS_ATTENTION"; elements.agent.dataset.state = approved; elements.agentStatus.textContent = label; elements.agentDetail.textContent = detail;
  const progress = Math.max(0, Math.min(100, Math.round(Number(progressPercent) || 0)));
  elements.progress.setAttribute("aria-valuenow", String(progress));
  elements.progressFill.style.width = `${progress}%`;
  elements.progressPercent.textContent = `${progress}%`;
  document.querySelectorAll(".stage-track li").forEach((item) => item.classList.toggle("active", item.dataset.stage === approved));
}

function updateRunDuration() { const duration = displayedRun?.active && displayedRun?.startedAt ? Date.now() - new Date(displayedRun.startedAt).valueOf() : displayedRun?.durationMs; const formatted = formatDuration(duration); setText("#summary-duration", formatted); setText("#run-elapsed", `Elapsed time: ${formatted}`); }
function setRunButton(disabled, label) { elements.runButton.disabled = disabled; elements.runButton.querySelector("span:last-child").textContent = label; }
function actionButton(label, action) { const button = makeText("button", label, "secondary-button small"); button.type = "button"; button.dataset.action = action; return button; }
function appendLink(parent, value, label, className, title = "") { const safe = safeHttpUrl(value); if (!safe) return; const link = makeText("a", label, className); link.href = safe; link.target = "_blank"; link.rel = "noreferrer"; if (title) { link.title = title; link.setAttribute("aria-label", title); } parent.append(link); }
function make(tag, className) { const node = document.createElement(tag); if (className) node.className = className; return node; }
function makeText(tag, text, className) { const node = make(tag, className); node.textContent = display(text); return node; }
function setText(selector, value) { const node = $(selector); if (node) node.textContent = String(value ?? ""); }
function display(value) { return value === null || value === undefined || String(value).trim() === "" ? "Unknown" : String(value); }
function displayNumber(value) { return Number.isFinite(Number(value)) ? String(Number(value)) : "—"; }
function runtimeReady() { return dashboard?.runtime?.status === "READY"; }
function joinKnown(...values) { return values.filter((value) => value && String(value).trim()).join(" · ") || "Unknown"; }
function titleCase(value) { return String(value || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function decisionClass(value) { return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-"); }
function deadlineLabel(value) { return value && value !== "Unknown" ? `Deadline ${value}` : "Deadline unknown"; }
function formatMaybeDate(value) { return value && value !== "Unknown" ? formatDateTime(value) : "Unknown"; }
function formatDateTime(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? display(value) : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatDuration(value) { const total = Math.max(0, Math.floor(Number(value) / 1_000)); if (!Number.isFinite(total)) return "—"; return total >= 60 ? `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s` : `${total}s`; }
function safeHttpUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } }
function studentInputLabel(input) { if (["READY_FOR_AGENT_REVIEW", "READY_FOR_UPDATE"].includes(input.status)) return "Your response is saved and ready for a targeted update."; if (["UPDATE_STARTING", "UPDATE_IN_PROGRESS"].includes(input.status)) return "The agent is processing your update now."; if (input.status === "UPDATE_FAILED") return input.nextStep || "The update did not finish; your response is still saved."; if (input.status === "REVIEWED") return `Reviewed: ${input.outcome || "complete"}`; return input.status === "NEEDS_MORE_INFORMATION" ? `More information needed: ${input.nextStep || "Review the next action."}` : titleCase(input.status); }
function materialTitle(type) { return ({ RESUME_TAILORING_CHECKLIST: "Resume-tailoring checklist", COVER_LETTER_OUTLINE: "Cover-letter outline", APPLICATION_QUESTION_WORKSHEET: "Application-question worksheet" })[type] || titleCase(type); }
async function localFetch(url, body) { return fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Local-Request-Token": requestToken }, body: JSON.stringify(body) }); }
async function copyText(value, confirmation) { if (!value) return showToast("Nothing is available to copy yet."); try { await navigator.clipboard.writeText(String(value)); showToast(confirmation); } catch { showToast("Copy was blocked. Select the visible text and copy it manually."); } }
function showToast(message) { elements.toast.textContent = message; elements.toast.hidden = false; window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 6_000); }
