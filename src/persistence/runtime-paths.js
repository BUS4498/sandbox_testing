import path from "node:path";

/**
 * Resolve private, changing runtime data under the repository's Git-ignored
 * data/local directory. A caller may provide `rootDir` for tests or an
 * explicitly configured install.
 */
export function resolveRuntimePaths({ rootDir, repositoryRoot = process.cwd() } = {}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedRoot = rootDir
    ? path.resolve(resolvedRepositoryRoot, rootDir)
    : path.join(resolvedRepositoryRoot, "data", "local");

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
