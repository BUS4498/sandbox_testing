import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnvironment } from "../src/config/local-env.js";
import { RunNowManager } from "../src/controller/run-now-manager.js";
import { CodexOutlookTransport } from "../src/notifications/codex-outlook-transport.js";
import { StudentEmailNotifier } from "../src/notifications/student-email-notifier.js";
import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSettingsStore } from "../src/persistence/local-settings-store.js";
import { resolveRuntimePaths } from "../src/persistence/runtime-paths.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";
import { createDashboardServer } from "../src/server/dashboard-server.js";
import { WorkflowActionCoordinator } from "../src/workflow/workflow-action-coordinator.js";
import { StudentResponseService } from "../src/workflow/student-response-service.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadLocalEnvironment(path.join(repositoryRoot, ".env"));
const runtimePaths = resolveRuntimePaths({
  rootDir: process.env.INTERNSHIP_AGENT_DATA_DIR,
  repositoryRoot,
});
const memoryStore = await new OperationalMemoryStore({ rootDir: runtimePaths.memory }).initialize();
const settingsStore = await new LocalSettingsStore({ filePath: runtimePaths.settings }).initialize();
const spreadsheetTracker = new LocalSpreadsheetTracker({ filePath: runtimePaths.spreadsheet });
const applicationMaterialStore = await new LocalApplicationMaterialStore({ rootDir: runtimePaths.applicationMaterials }).initialize();
const notificationMode = String(process.env.EMAIL_NOTIFICATIONS_MODE || "OUTLOOK").toUpperCase();
if (notificationMode === "LIVE") {
  throw new Error("Use OUTLOOK for Codex-managed email or DRY_RUN for local previews; no SMTP provider is implemented.");
}
const configuredNotificationEmail = (await settingsStore.getNotificationEmail()) || process.env.NOTIFICATION_EMAIL || null;
const workflowCoordinator = new WorkflowActionCoordinator({ spreadsheetTracker, memoryStore, applicationMaterialStore });
const runManager = new RunNowManager({ workspaceRoot: repositoryRoot, memoryStore, workflowCoordinator });
const outlookTransport = notificationMode === "OUTLOOK" ? new CodexOutlookTransport({ runManager }) : null;
const createNotifier = (recipient) => recipient
  ? new StudentEmailNotifier({
      recipient,
      memoryStore,
      outboxDir: runtimePaths.notificationOutbox,
      mode: notificationMode,
      transport: outlookTransport,
    })
  : null;
workflowCoordinator.setNotifier(createNotifier(configuredNotificationEmail));
const notificationConfiguration = {
  async snapshot() {
    const outlook = notificationMode === "OUTLOOK" ? await outlookTransport.readiness() : null;
    return settingsStore.publicNotificationSettings({
      mode: notificationMode,
      fallbackEmail: process.env.NOTIFICATION_EMAIL || null,
      outlook,
    });
  },
  async setRecipient(email) {
    await settingsStore.setNotificationEmail(email);
    workflowCoordinator.setNotifier(createNotifier(email));
    return this.snapshot();
  },
};
const studentResponseService = new StudentResponseService({ spreadsheetTracker, memoryStore });
const dashboard = createDashboardServer({
  runManager,
  spreadsheetTracker,
  memoryStore,
  runtimePaths,
  notificationConfiguration,
  studentResponseService,
  applicationMaterialStore,
});

const port = parsePort(process.env.PORT || "4318");
const address = await dashboard.listen({ host: "127.0.0.1", port });
process.stdout.write(`Internship Application Prep dashboard ready at ${address.url}\n`);
process.stdout.write(`Runtime data stays local at ${runtimePaths.root}\n`);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await dashboard.close();
  await runManager.close();
}

process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError(`Invalid PORT: ${value}.`);
  return port;
}
