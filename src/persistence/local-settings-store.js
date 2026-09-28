import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Store non-secret local preferences in the repository's Git-ignored runtime area. */
export class LocalSettingsStore {
  #writeQueue = Promise.resolve();

  constructor({ filePath, clock = () => new Date() }) {
    if (!filePath) throw new TypeError("LocalSettingsStore requires filePath.");
    this.filePath = path.resolve(filePath);
    this.clock = clock;
  }

  async initialize() {
    try {
      await this.#read();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.#write(createDefaultSettings(this.clock().toISOString()));
    }
    return this;
  }

  async getNotificationEmail() {
    const settings = await this.#read();
    return settings.notification?.email || null;
  }

  async setNotificationEmail(value) {
    const email = normalizeEmail(value);
    return this.#enqueue(async () => {
      const settings = await this.#read();
      const now = this.clock().toISOString();
      settings.notification = { email, updatedAt: now };
      settings.updatedAt = now;
      await this.#write(settings);
      return { configured: true, recipientHint: maskEmail(email), updatedAt: now };
    });
  }

  async publicNotificationSettings({ mode = "DRY_RUN", fallbackEmail = null } = {}) {
    const storedEmail = await this.getNotificationEmail();
    const email = storedEmail || (fallbackEmail ? normalizeEmail(fallbackEmail) : null);
    const normalizedMode = String(mode).toUpperCase();
    return {
      configured: Boolean(email),
      recipientHint: email ? maskEmail(email) : null,
      mode: normalizedMode,
      deliveryStatus: normalizedMode === "LIVE" ? "PROVIDER_CONFIGURED" : "LOCAL_PREVIEW_ONLY",
      explanation: normalizedMode === "LIVE"
        ? "Material-update emails are submitted through the separately approved local provider."
        : "Material updates create a local email preview; no external email is sent.",
    };
  }

  async getSchedule() {
    const settings = await this.#read();
    return structuredClone(settings.schedule ?? createDefaultSchedule());
  }

  async setSchedule({ enabled, time }) {
    const normalizedTime = normalizeDailyTime(time);
    return this.#enqueue(async () => {
      const settings = await this.#read();
      const now = this.clock().toISOString();
      settings.schedule = {
        ...(settings.schedule ?? createDefaultSchedule()),
        enabled: Boolean(enabled),
        time: normalizedTime,
        updatedAt: now,
      };
      settings.updatedAt = now;
      await this.#write(settings);
      return structuredClone(settings.schedule);
    });
  }

  async updateScheduleRuntime(patch) {
    return this.#enqueue(async () => {
      const settings = await this.#read();
      settings.schedule = { ...(settings.schedule ?? createDefaultSchedule()), ...structuredClone(patch) };
      settings.updatedAt = this.clock().toISOString();
      await this.#write(settings);
      return structuredClone(settings.schedule);
    });
  }

  async #read() {
    const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
    if (parsed?.schemaVersion !== 1) throw new Error("Local settings use an unsupported schema version.");
    return parsed;
  }

  async #write(settings) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: "utf8",
      flag: "w",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }

  #enqueue(operation) {
    const queued = this.#writeQueue.then(operation, operation);
    this.#writeQueue = queued.catch(() => undefined);
    return queued;
  }
}

export function normalizeEmail(value) {
  const email = String(value ?? "").trim();
  if (email.length > 254 || /\r|\n/.test(email) || !EMAIL_PATTERN.test(email)) {
    throw new TypeError("Enter a valid student notification email address.");
  }
  return email;
}

export function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export function normalizeDailyTime(value) {
  const time = String(value ?? "").trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new TypeError("Choose a valid local daily time.");
  }
  return time;
}

function createDefaultSchedule() {
  return {
    enabled: false,
    time: "09:00",
    updatedAt: null,
    lastScheduledFor: null,
    lastRun: null,
    lastOutcome: null,
    missedRun: null,
  };
}

function createDefaultSettings(timestamp) {
  return {
    schemaVersion: 1,
    updatedAt: timestamp,
    notification: { email: null, updatedAt: null },
    schedule: createDefaultSchedule(),
  };
}
