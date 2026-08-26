import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const localRequire = createRequire(import.meta.url);

const TARGETS = Object.freeze({
  "linux:x64": {
    packageName: "@openai/codex-linux-x64",
    triple: "x86_64-unknown-linux-musl",
    executable: "codex",
  },
  "linux:arm64": {
    packageName: "@openai/codex-linux-arm64",
    triple: "aarch64-unknown-linux-musl",
    executable: "codex",
  },
  "darwin:x64": {
    packageName: "@openai/codex-darwin-x64",
    triple: "x86_64-apple-darwin",
    executable: "codex",
  },
  "darwin:arm64": {
    packageName: "@openai/codex-darwin-arm64",
    triple: "aarch64-apple-darwin",
    executable: "codex",
  },
  "win32:x64": {
    packageName: "@openai/codex-win32-x64",
    triple: "x86_64-pc-windows-msvc",
    executable: "codex.exe",
  },
  "win32:arm64": {
    packageName: "@openai/codex-win32-arm64",
    triple: "aarch64-pc-windows-msvc",
    executable: "codex.exe",
  },
});

export function resolveCodexCommand({
  explicitCommand = process.env.CODEX_BINARY,
  platform = process.platform,
  architecture = process.arch,
  resolvePackage = (specifier) => localRequire.resolve(specifier),
  fileExists = existsSync,
} = {}) {
  const explicit = String(explicitCommand ?? "").trim();
  if (explicit) return explicit;

  const target = TARGETS[`${platform}:${architecture}`];
  if (!target) return "codex";

  try {
    const packageJson = resolvePackage(`${target.packageName}/package.json`);
    const candidate = path.join(
      path.dirname(packageJson),
      "vendor",
      target.triple,
      "bin",
      target.executable,
    );
    if (fileExists(candidate)) return candidate;
  } catch {
    // Fall back to PATH so an independently installed Codex CLI can be used.
  }

  return "codex";
}
