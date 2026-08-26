import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  CodexAppServerClient,
  CodexAppServerError,
} from "../src/controller/index.js";

class FakeChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdin = new PassThrough();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.killed = false;
  }

  kill(signal = "SIGTERM") {
    if (this.killed) return false;
    this.killed = true;
    queueMicrotask(() => this.emit("exit", null, signal));
    return true;
  }
}

function createHarness(options = {}) {
  const child = new FakeChildProcess();
  const messages = [];
  const invocations = [];
  let buffer = "";

  child.stdin.setEncoding("utf8");
  child.stdin.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line) messages.push(JSON.parse(line));
    }
  });

  const spawnProcess = (command, args, spawnOptions) => {
    invocations.push({ command, args, options: spawnOptions });
    queueMicrotask(() => child.emit("spawn"));
    return child;
  };

  const client = new CodexAppServerClient({
    cwd: "C:\\workspace\\internship-agent",
    codexCommand: "codex",
    requestTimeoutMs: 500,
    spawnProcess,
    ...options,
  });

  return { child, client, invocations, messages };
}

async function flushEvents() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("launches Codex App Server directly over stdio", async () => {
  const { client, invocations } = createHarness();

  await client.start();

  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].command, "codex");
  assert.deepEqual(invocations[0].args, [
    "app-server",
    "--listen",
    "stdio://",
  ]);
  assert.equal(invocations[0].options.shell, false);
  assert.deepEqual(invocations[0].options.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(client.running, true);

  await client.close();
});

test("performs initialize then initialized handshake", async () => {
  const { child, client, messages } = createHarness();

  const initializing = client.initialize();
  await flushEvents();

  assert.equal(messages[0].method, "initialize");
  assert.equal(messages[0].params.clientInfo.name, "internship_application_prep_dashboard");
  assert.deepEqual(messages[0].params.capabilities.optOutNotificationMethods, [
    "item/reasoning/textDelta",
    "item/reasoning/summaryTextDelta",
    "item/reasoning/summaryPartAdded",
    "item/agentMessage/delta",
  ]);
  assert.equal(Object.hasOwn(messages[0], "jsonrpc"), false);

  child.stdout.write(
    `${JSON.stringify({
      id: messages[0].id,
      result: { platformFamily: "windows", platformOs: "windows" },
    })}\n`,
  );

  const result = await initializing;
  assert.equal(result.platformFamily, "windows");
  assert.deepEqual(messages[1], { method: "initialized", params: {} });
  assert.equal(client.initialized, true);

  await client.close();
});

test("reads App Server authentication state only after initialization", async () => {
  const { child, client, messages } = createHarness();
  await assert.rejects(() => client.readAccount(), /initialized/i);

  const initializing = client.initialize();
  await flushEvents();
  child.stdout.write(`${JSON.stringify({ id: messages[0].id, result: {} })}\n`);
  await initializing;

  const reading = client.readAccount();
  await flushEvents();
  const request = messages.find((message) => message.method === "account/read");
  assert.deepEqual(request.params, { refreshToken: false });
  child.stdout.write(
    `${JSON.stringify({
      id: request.id,
      result: { account: { type: "chatgpt", email: "synthetic@example.edu" }, requiresOpenaiAuth: true },
    })}\n`,
  );
  const result = await reading;
  assert.equal(result.account.type, "chatgpt");

  await client.close();
});

test("queries app metadata and callable installed state through App Server", async () => {
  const { child, client, messages } = createHarness();
  const initializing = client.initialize();
  await flushEvents();
  child.stdout.write(`${JSON.stringify({ id: messages[0].id, result: {} })}\n`);
  await initializing;

  const listing = client.listApps({ threadId: "thr_apps", forceRefetch: true });
  await flushEvents();
  const listRequest = messages.find((message) => message.method === "app/list");
  assert.deepEqual(listRequest.params, { threadId: "thr_apps", forceRefetch: true });
  child.stdout.write(`${JSON.stringify({ id: listRequest.id, result: { data: [{ id: "outlook", name: "Outlook Email" }], nextCursor: null } })}\n`);
  assert.equal((await listing).data[0].name, "Outlook Email");

  const installed = client.installedApps({ threadId: "thr_apps", forceRefresh: true });
  await flushEvents();
  const installedRequest = messages.find((message) => message.method === "app/installed");
  assert.deepEqual(installedRequest.params, { threadId: "thr_apps", forceRefresh: true });
  child.stdout.write(`${JSON.stringify({ id: installedRequest.id, result: { apps: [{ id: "outlook", enabled: true, callable: true }] } })}\n`);
  assert.equal((await installed).apps[0].callable, true);
  await client.close();
});

test("routes notifications without interpreting private reasoning", async () => {
  const { child, client } = createHarness();
  await client.start();

  const notification = once(client, "notification");
  child.stdout.write(
    `${JSON.stringify({
      method: "turn/started",
      params: { turn: { id: "turn_123", status: "inProgress" } },
    })}\n`,
  );

  const [message] = await notification;
  assert.equal(message.method, "turn/started");
  assert.equal(message.params.turn.id, "turn_123");

  await client.close();
});

test("surfaces server requests and requires an explicit response", async () => {
  const { child, client, messages } = createHarness();
  await client.start();

  const serverRequest = once(client, "server-request");
  child.stdout.write(
    `${JSON.stringify({
      id: 91,
      method: "item/commandExecution/requestApproval",
      params: { command: "example" },
    })}\n`,
  );

  const [request] = await serverRequest;
  assert.equal(request.id, 91);
  assert.equal(messages.length, 0);

  client.respondResult(request.id, { decision: "decline" });
  assert.deepEqual(messages[0], {
    id: 91,
    result: { decision: "decline" },
  });

  await client.close();
});

test("rejects a request when App Server returns an error", async () => {
  const { child, client, messages } = createHarness();
  await client.start();

  const request = client.request("thread/read", { threadId: "missing" });
  await flushEvents();
  child.stdout.write(
    `${JSON.stringify({
      id: messages[0].id,
      error: { code: -32600, message: "thread not found" },
    })}\n`,
  );

  await assert.rejects(request, (error) => {
    assert.ok(error instanceof CodexAppServerError);
    assert.equal(error.code, -32600);
    assert.equal(error.message, "thread not found");
    return true;
  });

  await client.close();
});

test("reports malformed protocol input without crashing", async () => {
  const { child, client } = createHarness();
  await client.start();

  const protocolError = once(client, "protocol-error");
  child.stdout.write("not-json\n");

  const [error] = await protocolError;
  assert.ok(error instanceof CodexAppServerError);
  assert.equal(error.code, "INVALID_JSON");
  assert.equal(client.running, true);

  await client.close();
});

test("blocks thread operations until initialization succeeds", async () => {
  const { client } = createHarness();
  await client.start();

  await assert.rejects(client.startThread(), (error) => {
    assert.equal(error.code, "NOT_INITIALIZED");
    return true;
  });

  await client.close();
});

test("reports and cleans up a process launch failure", async () => {
  const child = new FakeChildProcess();
  const launchError = Object.assign(new Error("access denied"), {
    code: "EACCES",
  });
  const client = new CodexAppServerClient({
    spawnProcess: () => {
      queueMicrotask(() => child.emit("error", launchError));
      return child;
    },
  });

  await assert.rejects(client.start(), (error) => {
    assert.equal(error.code, "SPAWN_FAILED");
    assert.equal(error.cause.code, "EACCES");
    return true;
  });
  assert.equal(client.running, false);

  await client.close();
});
