import { readFile } from "node:fs/promises";

const DEFAULT_ALLOWED_KEYS = new Set([
  "EMAIL_NOTIFICATIONS_MODE",
  "NOTIFICATION_EMAIL",
  "EMAIL_SERVICE_USERNAME",
  "EMAIL_SERVICE_PASSWORD",
  "INTERNSHIP_AGENT_DATA_DIR",
  "PORT",
  "CODEX_BINARY",
  "ARTIFACT_TOOL_MODULE_PATH",
]);

/** Load only recognized local configuration names. No interpolation or command expansion is performed. */
export async function loadLocalEnvironment(filePath, { target = process.env, allowedKeys = DEFAULT_ALLOWED_KEYS } = {}) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { loaded: false, keys: [] };
    throw error;
  }

  const loadedKeys = [];
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) throw new Error(`Invalid local environment entry at line ${index + 1}.`);
    const [, key, rawValue] = match;
    if (!allowedKeys.has(key) || target[key] !== undefined) continue;
    target[key] = parseValue(rawValue.trim(), index + 1);
    loadedKeys.push(key);
  }
  return { loaded: true, keys: loadedKeys };
}
function parseValue(value, lineNumber) {
  if (!value) return "";
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const quote = value[0];
    const inner = value.slice(1, -1);
    return quote === '"'
      ? inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      : inner;
  }
  if (/[`$][({]/.test(value)) {
    throw new Error(`Environment interpolation or command syntax is not supported at line ${lineNumber}.`);
  }
  return value.replace(/\s+#.*$/, "").trim();
}
