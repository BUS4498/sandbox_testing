import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_EXPORTS = ["FileBlob", "SpreadsheetFile", "Workbook"];

export async function loadArtifactTool({ modulePath } = {}) {
  try {
    const packageModule = await import("@oai/artifact-tool");
    return assertRequiredExports(packageModule);
  } catch (packageError) {
    const candidates = [
      modulePath,
      process.env.ARTIFACT_TOOL_MODULE_PATH,
      path.join(
        os.homedir(),
        ".cache",
        "codex-runtimes",
        "codex-primary-runtime",
        "dependencies",
        "node",
        "node_modules",
        "@oai",
        "artifact-tool",
        "dist",
        "artifact_tool.mjs",
      ),
    ].filter(Boolean);

    for (const candidate of candidates) {
      const entryPoint = await resolveEntryPoint(candidate);
      if (!entryPoint) continue;
      try {
        return assertRequiredExports(await import(pathToFileURL(entryPoint).href));
      } catch {
        // Continue so the final error explains the supported configuration paths.
      }
    }

    throw new Error(
      "The spreadsheet engine could not be loaded. Run through the bundled Codex workspace runtime, " +
        "make @oai/artifact-tool resolvable, or set ARTIFACT_TOOL_MODULE_PATH to its package directory or artifact_tool.mjs entry point.",
      { cause: packageError },
    );
  }
}
async function resolveEntryPoint(candidate) {
  const resolved = path.resolve(candidate);
  const paths = resolved.endsWith(".mjs")
    ? [resolved]
    : [path.join(resolved, "dist", "artifact_tool.mjs"), resolved];

  for (const entryPoint of paths) {
    try {
      await access(entryPoint);
      return entryPoint;
    } catch {
      // Try the next candidate shape.
    }
  }
  return null;
}

function assertRequiredExports(module) {
  const missing = REQUIRED_EXPORTS.filter((name) => !(name in module));
  if (missing.length > 0) {
    throw new Error(`Spreadsheet engine is missing required exports: ${missing.join(", ")}.`);
  }
  return module;
}
