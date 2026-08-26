import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const APPLICATION_DIRECTORY = "Internship Application Prep Agent";
const LEGACY_APPLICATION_DIRECTORY = "Internship Application Operations Agent";

/**
 * Resolve private, changing runtime data outside the Git repository.
 * A caller may provide `rootDir` for tests or an explicitly configured install.
 */
export function resolveRuntimePaths({ rootDir, platform = process.platform, env = process.env } = {}) {
  const resolvedRoot = path.resolve(rootDir ?? defaultRuntimeRoot({ platform, env }));

  return Object.freeze({
    root: resolvedRoot,
    spreadsheet: path.join(resolvedRoot, "internship_pipeline.xlsx"),
    memory: path.join(resolvedRoot, "memory"),
    logs: path.join(resolvedRoot, "logs"),
    notificationOutbox: path.join(resolvedRoot, "notification-outbox"),
    applicationMaterials: path.join(resolvedRoot, "application-materials"),
    settings: path.join(resolvedRoot, "settings.json"),
  });
}

function defaultRuntimeRoot({ platform, env }) {
  const home = os.homedir();

  if (platform === "win32") {
    return compatibleRuntimeRoot(env.LOCALAPPDATA || path.join(home, "AppData", "Local"));
  }

  if (platform === "darwin") {
    return compatibleRuntimeRoot(path.join(home, "Library", "Application Support"));
  }

  return compatibleRuntimeRoot(env.XDG_DATA_HOME || path.join(home, ".local", "share"));
}

function compatibleRuntimeRoot(parent) {
  const current = path.join(parent, APPLICATION_DIRECTORY);
  const legacy = path.join(parent, LEGACY_APPLICATION_DIRECTORY);
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}
