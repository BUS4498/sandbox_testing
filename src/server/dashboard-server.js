import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RunAlreadyActiveError } from "../controller/run-now-manager.js";
import { buildDashboardData } from "./dashboard-data.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATIC_ROOT = path.resolve(HERE, "..", "..", "frontend", "app");
const STATIC_FILES = Object.freeze({
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
});

export function createDashboardServer({
  runManager,
  spreadsheetTracker,
  memoryStore,
  runtimePaths,
  notificationConfiguration = null,
  studentResponseService = null,
  applicationMaterialStore = null,
  localResetService = null,
  staticRoot = DEFAULT_STATIC_ROOT,
  clock = () => new Date(),
  requestToken = randomBytes(24).toString("base64url"),
}) {
  if (!runManager || !spreadsheetTracker || !memoryStore || !runtimePaths) {
    throw new TypeError("Dashboard server requires run manager, spreadsheet tracker, memory store, and runtime paths.");
  }

  const eventClients = new Set();
  const server = createServer(async (request, response) => {
    applySecurityHeaders(response);
    try {
      if (!isLocalHostHeader(request.headers.host)) return sendJson(response, 403, { error: "Local access only." });
      const url = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, { status: "ok", local: true });
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const data = await buildDashboardData({
          spreadsheetTracker,
          memoryStore,
          runManager,
          runtimePaths,
          notificationConfiguration,
          applicationMaterialStore,
          requestToken,
          clock,
        });
        return sendJson(response, 200, data);
      }

      if (request.method === "GET" && url.pathname === "/api/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.write(`data: ${JSON.stringify({ type: "stream.connected", timestamp: clock().toISOString() })}\n\n`);
        eventClients.add(response);
        request.on("close", () => eventClients.delete(response));
        return;
      }

      if (request.method === "POST" && ["/api/collect", "/api/runs"].includes(url.pathname)) {
        requireLocalMutation(request, requestToken);
        const run = typeof runManager.startCollection === "function"
          ? runManager.startCollection()
          : runManager.startRun();
        return sendJson(response, 202, { run });
      }

      if (request.method === "POST" && url.pathname === "/api/settings/notification") {
        requireLocalMutation(request, requestToken);
        if (typeof notificationConfiguration?.setRecipient !== "function") {
          throw httpError(503, "Local notification settings are unavailable.");
        }
        const body = await readJsonBody(request);
        try {
          const settings = await notificationConfiguration.setRecipient(body.email);
          return sendJson(response, 200, { settings });
        } catch (error) {
          if (error instanceof TypeError) throw httpError(400, error.message);
          throw error;
        }
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        requireLocalMutation(request, requestToken);
        if (typeof localResetService?.reset !== "function") throw httpError(503, "Collection reset is unavailable.");
        const body = await readJsonBody(request);
        try {
          const result = await localResetService.reset({ confirmation: body.confirmation });
          broadcast({ type: "collection.reset", result, timestamp: clock().toISOString() });
          return sendJson(response, 200, { result });
        } catch (error) {
          if (error instanceof TypeError) throw httpError(400, error.message);
          if (error.code === "RUN_ACTIVE") throw httpError(409, error.message);
          throw error;
        }
      }

      const responseMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)\/responses$/);
      if (request.method === "POST" && responseMatch) {
        requireLocalMutation(request, requestToken);
        if (typeof studentResponseService?.submit !== "function") throw httpError(503, "Student response storage is unavailable.");
        const body = await readJsonBody(request);
        const result = await studentResponseService.submit({
          opportunityId: decodeURIComponent(responseMatch[1]),
          type: body.type,
          text: body.text,
          templateTypes: body.templateTypes,
        });
        return sendJson(response, 201, { response: result });
      }

      const updateMatch = url.pathname.match(/^\/api\/opportunities\/([^/]+)\/update$/);
      if (request.method === "POST" && updateMatch) {
        requireLocalMutation(request, requestToken);
        if (typeof studentResponseService?.submit !== "function" || typeof runManager.startUpdate !== "function") {
          throw httpError(503, "Targeted opportunity updates are unavailable.");
        }
        const opportunityId = decodeURIComponent(updateMatch[1]);
        const body = await readJsonBody(request);
        const saved = await studentResponseService.submit({
          opportunityId,
          type: body.type,
          text: body.text,
          templateTypes: body.templateTypes,
        });
        const opportunity = await spreadsheetTracker.getOpportunity(opportunityId);
        if (!opportunity) throw httpError(404, "The selected opportunity is no longer in the local collection.");
        try {
          const run = runManager.startUpdate({ opportunityId, opportunity, responseId: saved.responseId });
          if (typeof studentResponseService.markUpdateStarted === "function") {
            await studentResponseService.markUpdateStarted({ opportunityId, responseId: saved.responseId, runId: run.runId });
          }
          return sendJson(response, 202, { response: saved, run });
        } catch (error) {
          const reason = error instanceof RunAlreadyActiveError
            ? "Your information is saved. Another workflow is active; retry Update Opportunity after it finishes."
            : "Your information is saved, but the targeted update could not start. Select Update Opportunity to retry.";
          if (typeof studentResponseService.markUpdateDeferred === "function") {
            await studentResponseService.markUpdateDeferred({ opportunityId, responseId: saved.responseId, reason });
          }
          if (error instanceof RunAlreadyActiveError) {
            return sendJson(response, 409, { error: reason, response: saved, responseSaved: true, runId: error.runId });
          }
          throw error;
        }
      }

      const materialMatch = url.pathname.match(/^\/api\/materials\/([^/]+)$/);
      if (request.method === "GET" && materialMatch) {
        if (typeof applicationMaterialStore?.readMaterial !== "function") throw httpError(503, "Application-material storage is unavailable.");
        const material = await applicationMaterialStore.readMaterial(decodeURIComponent(materialMatch[1]));
        if (!material) throw httpError(404, "Application material not found.");
        return sendDownload(
          response,
          200,
          material.bytes,
          `${material.fileName || "application-template.docx"}`,
          material.contentType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }

      const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)$/);
      if (request.method === "POST" && approvalMatch) {
        requireLocalMutation(request, requestToken);
        const body = await readJsonBody(request);
        const result = await runManager.respondToApproval(decodeURIComponent(approvalMatch[1]), body.decision, body.answers);
        return sendJson(response, 200, result);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const asset = STATIC_FILES[url.pathname];
        if (asset) return sendStatic(response, path.join(staticRoot, asset[0]), asset[1], request.method === "HEAD");
      }

      return sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof RunAlreadyActiveError) {
        return sendJson(response, 409, { error: "Another agent workflow is already active.", runId: error.runId });
      }
      if (error.statusCode) return sendJson(response, error.statusCode, { error: error.message });
      return sendJson(response, 500, { error: "The local dashboard could not complete this request." });
    }
  });

  const broadcast = (event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of eventClients) client.write(payload);
  };
  runManager.on("event", broadcast);

  return {
    requestToken,
    server,
    async listen({ host = "127.0.0.1", port = 4318 } = {}) {
      if (!isLoopbackAddress(host)) throw new Error("The local dashboard may bind only to a loopback address.");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      const address = server.address();
      return { host, port: address.port, url: `http://${host}:${address.port}` };
    },
    async close() {
      runManager.off("event", broadcast);
      for (const client of eventClients) client.end();
      eventClients.clear();
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

function requireLocalMutation(request, expectedToken) {
  if (request.headers["content-type"] && !String(request.headers["content-type"]).startsWith("application/json")) {
    throw httpError(415, "Mutation requests must use application/json.");
  }
  const origin = request.headers.origin;
  if (origin) {
    const parsed = new URL(origin);
    if (!isLoopbackAddress(parsed.hostname)) throw httpError(403, "Cross-origin requests are not allowed.");
  }
  const observed = String(request.headers["x-local-request-token"] ?? "");
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(observed);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw httpError(403, "The local request token is missing or invalid.");
  }
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw httpError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

async function sendStatic(response, filePath, contentType, headOnly) {
  const content = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": content.length,
    "Cache-Control": "no-store",
  });
  response.end(headOnly ? undefined : content);
}

function sendJson(response, statusCode, body) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function sendDownload(response, statusCode, body, fileName, contentType) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const safeName = String(fileName).replace(/[^A-Za-z0-9._-]/g, "-");
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function applySecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function isLocalHostHeader(value) {
  if (!value) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(value);
}

function isLoopbackAddress(value) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(value).toLowerCase());
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
