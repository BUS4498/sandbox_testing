import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const opportunities = sqliteTable("opportunities", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  employerPostingId: text("employer_posting_id").notNull().default(""),
  normalizedCompany: text("normalized_company").notNull(),
  normalizedRole: text("normalized_role").notNull(),
  normalizedLocation: text("normalized_location").notNull(),
  normalizedPeriod: text("normalized_period").notNull(),
  recordJson: text("record_json").notNull(),
  recordVersion: integer("record_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("uq_opportunities_owner_url").on(table.ownerId, table.canonicalUrl),
  index("idx_opportunities_owner_company_role").on(table.ownerId, table.normalizedCompany, table.normalizedRole),
]);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull().default("COLLECTION"),
  status: text("status").notNull(),
  stage: text("stage").notNull(),
  detail: text("detail").notNull(),
  progress: integer("progress").notNull().default(0),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  summaryJson: text("summary_json"),
  errorCode: text("error_code"),
  // Owner-scoped, structured checkpoints for a resumable collection run.
  jobJson: text("job_json"),
  jobLeaseUntil: text("job_lease_until"),
  jobLeaseToken: text("job_lease_token"),
}, (table) => [index("idx_runs_owner_started").on(table.ownerId, table.startedAt)]);

export const runLocks = sqliteTable("run_locks", {
  ownerId: text("owner_id").primaryKey(),
  runId: text("run_id").notNull(),
  expiresAt: text("expires_at").notNull(),
});

// Admission history is deliberately separate from resettable collection runs.
// A student cannot regain a provider-funded slot by resetting the collection.
export const usageAdmissions = sqliteTable("usage_admissions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  usageGroup: text("usage_group").notNull(),
  startedAt: text("started_at").notNull(),
}, (table) => [
  index("idx_usage_owner_kind_started").on(table.ownerId, table.kind, table.startedAt),
  index("idx_usage_group_started").on(table.usageGroup, table.startedAt),
]);

export const operationalEvents = sqliteTable("operational_events", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  runId: text("run_id").notNull(),
  opportunityId: text("opportunity_id"),
  kind: text("kind").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_events_owner_run").on(table.ownerId, table.runId),
  index("idx_events_owner_opportunity").on(table.ownerId, table.opportunityId),
]);

// Only the student-reviewed, non-identifying projection lives in D1. Resume
// extraction runs in the browser; an original is retained in private R2 only
// after that student's separate opt-in.
export const studentSetups = sqliteTable("student_setups", {
  ownerId: text("owner_id").primaryKey(),
  mode: text("mode").notNull(),
  profileText: text("profile_text").notNull().default(""),
  preferencesJson: text("preferences_json").notNull().default("{}"),
  confirmedAt: text("confirmed_at"),
  updatedAt: text("updated_at").notNull(),
});

export const studentResponses = sqliteTable("student_responses", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  opportunityId: text("opportunity_id").notNull(),
  opportunityVersion: integer("opportunity_version").notNull(),
  responseType: text("response_type").notNull(),
  responseText: text("response_text").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  processedAt: text("processed_at"),
  errorCode: text("error_code"),
}, (table) => [
  index("idx_student_responses_owner_opportunity").on(table.ownerId, table.opportunityId, table.createdAt),
]);

// The Word bytes live in private R2; D1 keeps owner-scoped metadata only.
export const applicationMaterials = sqliteTable("application_materials", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  opportunityId: text("opportunity_id").notNull(),
  requestId: text("request_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentHash: text("content_hash").notNull(),
  placeholdersJson: text("placeholders_json").notNull(),
  opportunityVersion: integer("opportunity_version").notNull(),
  profileMode: text("profile_mode").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull(),
}, (table) => [
  uniqueIndex("uq_materials_owner_request_type").on(table.ownerId, table.requestId, table.type),
  index("idx_materials_owner_opportunity_created").on(table.ownerId, table.opportunityId, table.createdAt),
]);

// Historical, inactive cloud-schedule tables are retained so existing private
// database history is not dropped. No Site route or GitHub workflow uses them.
export const dailySchedules = sqliteTable("daily_schedules", {
  ownerId: text("owner_id").primaryKey(),
  enabled: integer("enabled").notNull().default(0),
  tokenHash: text("token_hash"),
  connectedAt: text("connected_at"),
  enabledAt: text("enabled_at"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("uq_daily_schedule_token_hash").on(table.tokenHash)]);

export const dailyAttempts = sqliteTable("daily_attempts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  localDate: text("local_date").notNull(),
  githubRunId: text("github_run_id").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  collectionRunId: text("collection_run_id"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
}, (table) => [
  uniqueIndex("uq_daily_attempt_owner_date").on(table.ownerId, table.localDate),
  uniqueIndex("uq_daily_attempt_github_run_id").on(table.githubRunId),
  index("idx_daily_attempt_owner_started").on(table.ownerId, table.startedAt),
]);
