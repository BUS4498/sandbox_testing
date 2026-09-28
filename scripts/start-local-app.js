import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnvironment } from "../src/config/local-env.js";
import { RunNowManager } from "../src/controller/run-now-manager.js";
import { StudentEmailNotifier } from "../src/notifications/student-email-notifier.js";
import { LocalApplicationMaterialStore } from "../src/persistence/application-material-store.js";
import { LocalRuntimeResetService } from "../src/persistence/local-runtime-reset-service.js";
import { OperationalMemoryStore } from "../src/persistence/operational-memory-store.js";
import { LocalSettingsStore } from "../src/persistence/local-settings-store.js";
import { LocalStudentProfileStore } from "../src/persistence/student-profile-store.js";
import { resolveRuntimePaths } from "../src/persistence/runtime-paths.js";
import { LocalSpreadsheetTracker } from "../src/persistence/spreadsheet-tracker.js";
import { LocalDailyScheduler } from "../src/schedule/local-daily-scheduler.js";
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
const spreadsheetTracker = await new LocalSpreadsheetTracker({ filePath: runtimePaths.spreadsheet }).initialize();
if (spreadsheetTracker.lastRecovery) {
  process.stdout.write(`Unreadable spreadsheet preserved at ${spreadsheetTracker.lastRecovery.archivePath}\n`);
}
const applicationMaterialStore = await new LocalApplicationMaterialStore({ rootDir: runtimePaths.applicationMaterials }).initialize();
const studentProfileStore = await new LocalStudentProfileStore({ rootDir: runtimePaths.studentProfile }).initialize();
const notificationMode = String(process.env.EMAIL_NOTIFICATIONS_MODE || "DRY_RUN").toUpperCase();
if (notificationMode !== "DRY_RUN") {
  throw new Error("This version supports DRY_RUN notification previews only; no live email provider is implemented.");
}
const configuredNotificationEmail = (await settingsStore.getNotificationEmail()) || process.env.NOTIFICATION_EMAIL || null;
const workflowCoordinator = new WorkflowActionCoordinator({ spreadsheetTracker, memoryStore, applicationMaterialStore });
const runManager = new RunNowManager({ workspaceRoot: repositoryRoot, memoryStore, spreadsheetTracker, workflowCoordinator, studentProfileStore });
const localResetService = new LocalRuntimeResetService({ runtimePaths, spreadsheetTracker, memoryStore, applicationMaterialStore, runManager });
const createNotifier = (recipient) => recipient
  ? new StudentEmailNotifier({
      recipient,
      memoryStore,
      outboxDir: runtimePaths.notificationOutbox,
      mode: notificationMode,
    })
  : null;
workflowCoordinator.setNotifier(createNotifier(configuredNotificationEmail));
const notificationConfiguration = {
  async snapshot() {
    return settingsStore.publicNotificationSettings({
      mode: notificationMode,
      fallbackEmail: process.env.NOTIFICATION_EMAIL || null,
    });
  },
  async setRecipient(email) {
    await settingsStore.setNotificationEmail(email);
    workflowCoordinator.setNotifier(createNotifier(email));
    return this.snapshot();
  },
};
const scheduleConfiguration = await new LocalDailyScheduler({ settingsStore, memoryStore, runManager }).initialize();
const studentResponseService = new StudentResponseService({ spreadsheetTracker, memoryStore });
const dashboard = createDashboardServer({
  runManager,
  spreadsheetTracker,
  memoryStore,
  runtimePaths,
  notificationConfiguration,
  scheduleConfiguration,
  studentResponseService,
  applicationMaterialStore,
  localResetService,
  studentProfileStore,
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
  await scheduleConfiguration.close();
  await runManager.close();
}

process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));
process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError(`Invalid PORT: ${value}.`);
  return port;
}
