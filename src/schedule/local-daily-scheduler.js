import { RunAlreadyActiveError } from "../controller/run-now-manager.js";

const MAX_TIMEOUT_MS = 2_147_000_000;

/** One-process local scheduler. It never claims a run occurred while the app was closed. */
export class LocalDailyScheduler {
  #timer = null;
  #pendingRunId = null;

  constructor({ settingsStore, memoryStore, runManager, clock = () => new Date(), setTimer = setTimeout, clearTimer = clearTimeout }) {
    if (!settingsStore || !memoryStore || !runManager) {
      throw new TypeError("LocalDailyScheduler requires settings, memory, and run-manager dependencies.");
    }
    this.settingsStore = settingsStore;
    this.memoryStore = memoryStore;
    this.runManager = runManager;
    this.clock = clock;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onRunEvent = (event) => this.#handleRunEvent(event);
  }

  async initialize() {
    this.runManager.on("event", this.onRunEvent);
    const schedule = await this.settingsStore.getSchedule();
    const now = this.clock();
    const missedRun = detectMissedRun(schedule, now);
    const patch = { lastProcessSeenAt: now.toISOString(), missedRun };
    await this.settingsStore.updateScheduleRuntime(patch);
    await this.#publishState();
    await this.#arm();
    return this;
  }

  async snapshot() {
    const schedule = await this.settingsStore.getSchedule();
    const now = this.clock();
    return publicSchedule(schedule, now);
  }

  async configure({ enabled, time }) {
    await this.settingsStore.setSchedule({ enabled, time });
    await this.settingsStore.updateScheduleRuntime({
      missedRun: null,
      lastProcessSeenAt: this.clock().toISOString(),
    });
    await this.#arm();
    await this.#publishState();
    return this.snapshot();
  }

  async close() {
    if (this.#timer) this.clearTimer(this.#timer);
    this.#timer = null;
    this.runManager.off("event", this.onRunEvent);
  }

  async #arm() {
    if (this.#timer) this.clearTimer(this.#timer);
    this.#timer = null;
    const schedule = await this.settingsStore.getSchedule();
    if (!schedule.enabled) return;
    const next = nextOccurrence(schedule.time, this.clock());
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, next.valueOf() - this.clock().valueOf()));
    this.#timer = this.setTimer(() => this.#trigger().catch(() => undefined), delay);
    this.#timer?.unref?.();
  }

  async #trigger() {
    const schedule = await this.settingsStore.getSchedule();
    if (!schedule.enabled) return;
    const scheduledFor = mostRecentOccurrence(schedule.time, this.clock()).toISOString();
    try {
      if (typeof this.runManager.checkStudentSetupReadiness === "function") {
        const setup = await this.runManager.checkStudentSetupReadiness();
        if (!setup.ready) {
          await this.settingsStore.updateScheduleRuntime({
            lastScheduledFor: scheduledFor,
            lastRun: this.clock().toISOString(),
            lastOutcome: "NEEDS_STUDENT_SETUP",
            missedRun: null,
          });
          await this.#publishState();
          await this.#arm();
          return;
        }
      }
      const run = this.runManager.startCollection({ trigger: "SCHEDULED" });
      this.#pendingRunId = run.runId;
      await this.settingsStore.updateScheduleRuntime({
        lastScheduledFor: scheduledFor,
        lastRun: run.startedAt,
        lastOutcome: "IN_PROGRESS",
        missedRun: null,
      });
    } catch (error) {
      await this.settingsStore.updateScheduleRuntime({
        lastScheduledFor: scheduledFor,
        lastRun: this.clock().toISOString(),
        lastOutcome: error instanceof RunAlreadyActiveError ? "DEFERRED_ACTIVE_RUN" : "FAILURE",
        missedRun: null,
      });
    }
    await this.#publishState();
    await this.#arm();
  }

  async #handleRunEvent(event) {
    if (event?.type !== "run.completed" || !this.#pendingRunId || event.run?.runId !== this.#pendingRunId) return;
    this.#pendingRunId = null;
    await this.settingsStore.updateScheduleRuntime({
      lastRun: event.run.finishedAt ?? this.clock().toISOString(),
      lastOutcome: event.run.outcome ?? "UNKNOWN",
    });
    await this.#publishState();
  }

  async #publishState() {
    const snapshot = await this.snapshot();
    await this.memoryStore.updateRuntimeState({ schedule: snapshot });
    return snapshot;
  }
}

export function nextOccurrence(time, now = new Date()) {
  const [hour, minute] = String(time).split(":").map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

export function mostRecentOccurrence(time, now = new Date()) {
  const [hour, minute] = String(time).split(":").map(Number);
  const recent = new Date(now);
  recent.setHours(hour, minute, 0, 0);
  if (recent > now) recent.setDate(recent.getDate() - 1);
  return recent;
}

function detectMissedRun(schedule, now) {
  if (!schedule.enabled) return null;
  const due = mostRecentOccurrence(schedule.time, now);
  const evidence = [schedule.updatedAt, schedule.lastProcessSeenAt, schedule.lastScheduledFor]
    .filter(Boolean)
    .map((value) => new Date(value).valueOf())
    .filter(Number.isFinite);
  if (evidence.length === 0 || Math.max(...evidence) >= due.valueOf()) return null;
  return { scheduledFor: due.toISOString(), detectedAt: now.toISOString() };
}

function publicSchedule(schedule, now) {
  const next = schedule.enabled ? nextOccurrence(schedule.time, now).toISOString() : null;
  return {
    enabled: Boolean(schedule.enabled),
    status: schedule.missedRun ? "MISSED_RUN" : schedule.enabled ? "ENABLED" : "DISABLED",
    time: schedule.time,
    schedule: schedule.enabled ? `${schedule.time} daily while this app is running` : "Disabled",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lastRun: schedule.lastRun,
    lastOutcome: schedule.lastOutcome,
    nextRun: next,
    missedRun: schedule.missedRun,
    managedBy: "Local controller",
  };
}
