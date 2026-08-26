import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";

import { resolveCodexCommand } from "./codex-command-resolver.js";

const DEFAULT_CLIENT_INFO = Object.freeze({
  name: "internship_application_prep_dashboard",
  title: "Internship Application Prep Agent",
  version: "0.1.0",
});

const DEFAULT_CAPABILITIES = Object.freeze({
  optOutNotificationMethods: [
    "item/reasoning/textDelta",
    "item/reasoning/summaryTextDelta",
    "item/reasoning/summaryPartAdded",
    "item/agentMessage/delta",
  ],
});

export class CodexAppServerError extends Error {
  constructor(message, { code, data, cause } = {}) {
    super(message, { cause });
    this.name = "CodexAppServerError";
    this.code = code;
    this.data = data;
  }
}

/**
 * Thin JSONL client for the local Codex App Server.
 *
 * This class transports messages and exposes events. It deliberately does not
 * implement an LLM loop, select tools, or make approval decisions.
 */
export class CodexAppServerClient extends EventEmitter {
  #child = null;
  #lineReader = null;
  #nextRequestId = 1;
  #pending = new Map();
  #spawnProcess;
  #startPromise = null;
  #closing = false;

  constructor({
    codexCommand = resolveCodexCommand(),
    cwd = process.cwd(),
    clientInfo = DEFAULT_CLIENT_INFO,
    capabilities = DEFAULT_CAPABILITIES,
    requestTimeoutMs = 15_000,
    spawnProcess = spawn,
  } = {}) {
    super();
    this.codexCommand = codexCommand;
    this.cwd = cwd;
    this.clientInfo = { ...DEFAULT_CLIENT_INFO, ...clientInfo };
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...capabilities,
      optOutNotificationMethods: [
        ...new Set([
          ...DEFAULT_CAPABILITIES.optOutNotificationMethods,
          ...(capabilities?.optOutNotificationMethods ?? []),
        ]),
      ],
    };
    this.requestTimeoutMs = requestTimeoutMs;
    this.#spawnProcess = spawnProcess;
    this.initialized = false;
  }

  get running() {
    return this.#child !== null;
  }

  async start() {
    if (this.#child) {
      return this;
    }
    if (this.#startPromise) {
      return this.#startPromise;
    }

    this.#startPromise = this.#startProcess();
    try {
      await this.#startPromise;
      return this;
    } finally {
      this.#startPromise = null;
    }
  }

  async initialize() {
    await this.start();
    if (this.initialized) {
      return null;
    }

    const result = await this.request("initialize", {
      clientInfo: this.clientInfo,
      capabilities: this.capabilities,
    });
    this.notify("initialized", {});
    this.initialized = true;
    this.emit("initialized", result);
    return result;
  }

  async startThread(params = {}) {
    this.#requireInitialized();
    return this.request("thread/start", params);
  }

  async resumeThread(threadId, params = {}) {
    this.#requireInitialized();
    return this.request("thread/resume", { threadId, ...params });
  }

  async readAccount({ refreshToken = false } = {}) {
    this.#requireInitialized();
    return this.request("account/read", { refreshToken: refreshToken === true });
  }

  async listApps({ threadId, cursor, limit, forceRefetch = false } = {}) {
    this.#requireInitialized();
    return this.request("app/list", {
      ...(threadId ? { threadId } : {}),
      ...(cursor ? { cursor } : {}),
      ...(limit ? { limit } : {}),
      forceRefetch: forceRefetch === true,
    });
  }

  async installedApps({ threadId, forceRefresh = false } = {}) {
    this.#requireInitialized();
    return this.request("app/installed", {
      ...(threadId ? { threadId } : {}),
      forceRefresh: forceRefresh === true,
    });
  }

  async startTurn(threadId, input, params = {}) {
    this.#requireInitialized();
    return this.request("turn/start", { threadId, input, ...params });
  }

  async interruptTurn(threadId, turnId) {
    this.#requireInitialized();
    return this.request("turn/interrupt", { threadId, turnId });
  }

  request(method, params = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new CodexAppServerError(
            `Codex App Server request timed out: ${method}`,
            { code: "REQUEST_TIMEOUT", data: { id, method, timeoutMs } },
          ),
        );
      }, timeoutMs);
      timeout.unref?.();

      this.#pending.set(id, { method, resolve, reject, timeout });
      try {
        this.#write({ method, id, params });
      } catch (error) {
        clearTimeout(timeout);
        this.#pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method, params = {}) {
    this.#write({ method, params });
  }

  respondResult(id, result) {
    this.#write({ id, result });
  }

  respondError(id, code, message, data) {
    const error = { code, message };
    if (data !== undefined) {
      error.data = data;
    }
    this.#write({ id, error });
  }

  async close({ forceAfterMs = 1_000 } = {}) {
    const child = this.#child;
    if (!child) {
      return;
    }

    this.#closing = true;
    this.#rejectPending(
      new CodexAppServerError("Codex App Server client closed", {
        code: "CLIENT_CLOSED",
      }),
    );

    this.#lineReader?.close();
    this.#lineReader = null;
    child.stdin?.end();

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(forceTimer);
        resolve();
      };
      const forceTimer = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        finish();
      }, forceAfterMs);
      child.once("exit", finish);
      if (!child.killed) {
        child.kill();
      } else {
        finish();
      }
    });

    if (this.#child === child) {
      this.#child = null;
    }
    this.initialized = false;
    this.#closing = false;
  }

  async #startProcess() {
    let child;
    try {
      child = this.#spawnProcess(
        this.codexCommand,
        ["app-server", "--listen", "stdio://"],
        {
          cwd: this.cwd,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          windowsHide: true,
        },
      );
    } catch (cause) {
      throw new CodexAppServerError("Unable to launch Codex App Server", {
        code: "SPAWN_FAILED",
        cause,
      });
    }

    this.#child = child;
    this.#closing = false;

    this.#lineReader = readline.createInterface({ input: child.stdout });
    this.#lineReader.on("line", (line) => this.#handleLine(line));

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => this.emit("stderr", String(chunk)));
    child.on("exit", (code, signal) => this.#handleExit(code, signal));
    child.on("error", (cause) => {
      const error = new CodexAppServerError(
        "Codex App Server process failed",
        { code: "PROCESS_ERROR", cause },
      );
      this.emit("process-error", error);
      this.#rejectPending(error);
    });

    await new Promise((resolve, reject) => {
      const cleanup = () => {
        child.off("spawn", onSpawn);
        child.off("error", onError);
      };
      const onSpawn = () => {
        cleanup();
        resolve();
      };
      const onError = (cause) => {
        cleanup();
        if (this.#child === child) {
          this.#child = null;
        }
        this.#lineReader?.close();
        this.#lineReader = null;
        reject(
          new CodexAppServerError("Unable to launch Codex App Server", {
            code: "SPAWN_FAILED",
            cause,
          }),
        );
      };

      child.once("spawn", onSpawn);
      child.once("error", onError);
    });

    this.emit("started", {
      command: this.codexCommand,
      args: ["app-server", "--listen", "stdio://"],
      cwd: this.cwd,
    });
  }

  #handleLine(line) {
    if (!line.trim()) {
      return;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch (cause) {
      this.emit(
        "protocol-error",
        new CodexAppServerError("Invalid JSON from Codex App Server", {
          code: "INVALID_JSON",
          data: { line },
          cause,
        }),
      );
      return;
    }

    const hasId = Object.hasOwn(message, "id");
    const isResponse =
      hasId && (Object.hasOwn(message, "result") || Object.hasOwn(message, "error"));

    if (isResponse) {
      const pending = this.#pending.get(message.id);
      if (!pending) {
        this.emit("orphan-response", message);
        return;
      }

      clearTimeout(pending.timeout);
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new CodexAppServerError(
            message.error.message || `Codex App Server request failed: ${pending.method}`,
            {
              code: message.error.code,
              data: message.error.data,
            },
          ),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (hasId && message.method) {
      this.emit("server-request", message);
      return;
    }

    if (message.method) {
      this.emit("notification", message);
      this.emit(`notification:${message.method}`, message.params);
      return;
    }

    this.emit(
      "protocol-error",
      new CodexAppServerError("Unrecognized Codex App Server message", {
        code: "UNRECOGNIZED_MESSAGE",
        data: { message },
      }),
    );
  }

  #handleExit(code, signal) {
    const child = this.#child;
    this.#child = null;
    this.initialized = false;
    this.#lineReader?.close();
    this.#lineReader = null;

    if (!this.#closing) {
      this.#rejectPending(
        new CodexAppServerError("Codex App Server exited unexpectedly", {
          code: "PROCESS_EXIT",
          data: { code, signal },
        }),
      );
    }
    this.emit("exit", { child, code, signal, expected: this.#closing });
  }

  #rejectPending(error) {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #requireInitialized() {
    if (!this.initialized) {
      throw new CodexAppServerError(
        "Codex App Server must be initialized before starting threads or turns",
        { code: "NOT_INITIALIZED" },
      );
    }
  }

  #write(message) {
    if (!this.#child?.stdin?.writable) {
      throw new CodexAppServerError("Codex App Server is not running", {
        code: "NOT_RUNNING",
      });
    }
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }
}
