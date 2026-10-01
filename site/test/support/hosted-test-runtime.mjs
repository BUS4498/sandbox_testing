import { build } from "esbuild";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Isolated test-only bindings. Never used by the production app or deployed auth.
export async function hostedTestRuntime(extraExports = "") {
  const root = path.resolve(import.meta.dirname, "../..");
  const temp = await mkdtemp(path.join(os.tmpdir(), "resume-role-test-"));
  const db = new DatabaseSync(":memory:");
  for (const name of (await readdir(path.join(root, "drizzle"))).filter(name => name.endsWith(".sql")).sort()) {
    db.exec(await readFile(path.join(root, "drizzle", name), "utf8"));
  }
  const objects = new Map();
  function prepared(sql, args = []) {
    const statement = db.prepare(sql);
    return { bind(...values) { return prepared(sql, values); },
      async run() { const result = statement.run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      async first(column) { const row = statement.get(...args) ?? null; return column && row ? row[column] : row; },
      async all() { return { success: true, results: statement.all(...args) }; },
    };
  }
  function metadata(key) {
    const item = objects.get(key);
    return item ? { key, size: item.bytes.byteLength, uploaded: item.uploaded,
      httpMetadata: item.httpMetadata, customMetadata: item.customMetadata } : null;
  }
  const env = { OPENAI_API_KEY: "test-not-a-real-key", DB: { prepare: prepared,
    async batch(statements) { db.exec("BEGIN"); try { const result = []; for (const statement of statements) result.push(await statement.run()); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; } },
  }, BUCKET: {
    async put(key, value, options = {}) {
      const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      objects.set(key, { bytes, uploaded: new Date(), httpMetadata: options.httpMetadata ?? {}, customMetadata: options.customMetadata ?? {} });
      return metadata(key);
    },
    async get(key) { const item = objects.get(key); if (!item) return null; return { ...metadata(key),
      async json() { return JSON.parse(new TextDecoder().decode(item.bytes)); },
      async text() { return new TextDecoder().decode(item.bytes); },
      async arrayBuffer() { return item.bytes.slice().buffer; } }; },
    async head(key) { return metadata(key); },
    async list(options = {}) { return { objects: [...objects.keys()].filter(key => key.startsWith(options.prefix ?? "")).map(metadata), truncated: false }; },
    async delete(key) { for (const item of Array.isArray(key) ? key : [key]) objects.delete(item); },
  } };
  globalThis.__ROLE_TEST_ENV__ = env;
  globalThis.__ROLE_TEST_USER__ = { userId: "fixture-student-a" };
  const outfile = path.join(temp, "runtime.mjs");
  await build({ absWorkingDir: root, stdin: { contents: `export * from './lib/hosted/role-suggestions'; export * from './lib/hosted/role-suggestion-cache'; export * from './lib/hosted/store'; export { GET, POST } from './app/api/role-suggestions/route'; ${extraExports}`, resolveDir: root },
    outfile, bundle: true, platform: "node", format: "esm", logLevel: "silent", plugins: [{ name: "isolated-test-bindings", setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "test-bindings" }));
      builder.onResolve({ filter: /chatgpt-auth$/ }, () => ({ path: "auth", namespace: "test-bindings" }));
      builder.onLoad({ filter: /.*/, namespace: "test-bindings" }, args => ({ contents: args.path === "env" ? "export const env = globalThis.__ROLE_TEST_ENV__;" : "export async function getChatGPTUser() { return globalThis.__ROLE_TEST_USER__; }", loader: "js" }));
      builder.onResolve({ filter: /\.md\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: "raw-spec" }));
      builder.onLoad({ filter: /.*/, namespace: "raw-spec" }, async args => ({ contents: await readFile(args.path, "utf8"), loader: "text" }));
    } }] });
  const api = await import(pathToFileURL(outfile).href);
  return { api, env, db, objects, async close() { db.close(); await rm(temp, { recursive: true, force: true }); } };
}
