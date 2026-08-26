import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveCodexCommand } from "../src/controller/codex-command-resolver.js";

test("an explicit local Codex command takes precedence", () => {
  assert.equal(resolveCodexCommand({ explicitCommand: "C:\\tools\\codex.exe" }), "C:\\tools\\codex.exe");
});

test("resolves the project-local native Codex executable for the active platform", () => {
  const packageJson = path.join("C:\\project", "node_modules", "@openai", "codex-win32-x64", "package.json");
  const result = resolveCodexCommand({
    explicitCommand: "",
    platform: "win32",
    architecture: "x64",
    resolvePackage: () => packageJson,
    fileExists: () => true,
  });
  assert.equal(
    result,
    path.join(
      path.dirname(packageJson),
      "vendor",
      "x86_64-pc-windows-msvc",
      "bin",
      "codex.exe",
    ),
  );
});

test("falls back to PATH when no supported local native package is available", () => {
  assert.equal(
    resolveCodexCommand({
      explicitCommand: "",
      platform: "win32",
      architecture: "x64",
      resolvePackage: () => {
        throw new Error("missing");
      },
    }),
    "codex",
  );
});
