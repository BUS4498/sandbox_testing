import { closeSync, mkdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DASHBOARD_API_VERSION,
  DASHBOARD_APPLICATION_ID,
  DASHBOARD_RUNTIME_ID,
} from "../src/server/runtime-metadata.js";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

export function parseLauncherPort(value = "4318") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError(`Invalid PORT: ${value}.`);
  }
  return port;
}

export async function dashboardIsReady(url, { fetchImpl = globalThis.fetch } = {}) {
  const health = await readDashboardHealth(url, { fetchImpl });
  return health.compatible;
}

export async function readDashboardHealth(url, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(`${url}/api/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return { reachable: true, compatible: false, statusCode: response.status ?? null };
    const body = await response.json();
    return {
      reachable: true,
      compatible:
        body?.status === "ok" &&
        body?.local === true &&
        body?.applicationId === DASHBOARD_APPLICATION_ID &&
        body?.runtime === DASHBOARD_RUNTIME_ID &&
        Number(body?.apiVersion) === DASHBOARD_API_VERSION,
      body,
    };
  } catch {
    return { reachable: false, compatible: false, body: null };
  }
}

export function isOutdatedDashboard(health) {
  const body = health?.body;
  return health?.reachable === true &&
    body?.status === "ok" &&
    body?.local === true &&
    body?.applicationId === DASHBOARD_APPLICATION_ID &&
    body?.runtime === DASHBOARD_RUNTIME_ID &&
    Number(body?.apiVersion) !== DASHBOARD_API_VERSION;
}

export async function stopOutdatedDashboard(health, {
  killImpl = process.kill,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  if (!isOutdatedDashboard(health)) return false;
  const processId = Number(health.body?.processId);
  if (!Number.isInteger(processId) || processId < 1 || processId === process.pid) return false;
  if (health.body?.restartSafe !== true) return false;
  killImpl(processId, "SIGTERM");
  await sleep(350);
  return true;
}

export async function waitForDashboard(url, {
  attempts = 75,
  intervalMs = 400,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await dashboardIsReady(url, { fetchImpl })) return true;
    if (attempt < attempts - 1) await sleep(intervalMs);
  }
  return false;
}

export function browserLaunchCommand(url, platform = process.platform) {
  if (platform === "win32") {
    return { command: "explorer.exe", args: [url] };
  }
  if (platform === "darwin") return { command: "open", args: [url] };
  return { command: "xdg-open", args: [url] };
}

export async function openDashboard(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const launch = browserLaunchCommand(url, platform);
  const child = spawnImpl(launch.command, launch.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
}

export function startDashboardProcess({
  rootDir = repositoryRoot,
  spawnImpl = spawn,
  nodeExecutable = process.execPath,
  environment = process.env,
} = {}) {
  const logsDir = path.join(rootDir, "data", "local", "logs");
  const logPath = path.join(logsDir, "launcher.log");
  const serverScript = path.join(rootDir, "scripts", "start-local-app.js");
  mkdirSync(logsDir, { recursive: true });
  const logHandle = openSync(logPath, "a");

  try {
    const child = spawnImpl(nodeExecutable, [serverScript], {
      cwd: rootDir,
      detached: true,
      env: environment,
      stdio: ["ignore", logHandle, logHandle],
      windowsHide: true,
    });
    child.unref();
  } finally {
    closeSync(logHandle);
  }

  return logPath;
}

export async function launchLocalApp({
  openBrowser = true,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  killImpl = process.kill,
} = {}) {
  const port = parseLauncherPort(environment.PORT || "4318");
  const url = `http://127.0.0.1:${port}`;
  let logPath = null;
  let existing = await readDashboardHealth(url, { fetchImpl });

  if (existing.reachable && !existing.compatible) {
    const stopped = await stopOutdatedDashboard(existing, { killImpl });
    if (stopped) {
      existing = await readDashboardHealth(url, { fetchImpl });
    }
    if (existing.reachable && !existing.compatible) {
      const detail = isOutdatedDashboard(existing)
        ? "An older version of the Internship Application Prep Agent is still running. Finish any active run, close the app window, and launch it again."
        : `Port ${port} is already used by a different local application.`;
      throw new Error(detail);
    }
  }

  if (!existing.compatible) {
    process.stdout.write("Starting the Internship Application Prep Agent...\n");
    logPath = startDashboardProcess({ environment });
    const ready = await waitForDashboard(url, { fetchImpl });
    if (!ready) {
      throw new Error(`The dashboard did not start within 30 seconds. Review ${logPath}`);
    }
  }

  process.stdout.write(`Dashboard ready at ${url}\n`);
  if (openBrowser) await openDashboard(url);
  return { url, logPath, alreadyRunning: logPath === null };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isDirectRun) {
  launchLocalApp({ openBrowser: !process.argv.includes("--no-open") }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
