CREATE TABLE `operational_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`run_id` text NOT NULL,
	`opportunity_id` text,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_owner_run` ON `operational_events` (`owner_id`,`run_id`);--> statement-breakpoint
CREATE INDEX `idx_events_owner_opportunity` ON `operational_events` (`owner_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`employer_posting_id` text DEFAULT '' NOT NULL,
	`normalized_company` text NOT NULL,
	`normalized_role` text NOT NULL,
	`normalized_location` text NOT NULL,
	`normalized_period` text NOT NULL,
	`record_json` text NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_opportunities_owner_url` ON `opportunities` (`owner_id`,`canonical_url`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_owner_company_role` ON `opportunities` (`owner_id`,`normalized_company`,`normalized_role`);--> statement-breakpoint
CREATE TABLE `run_locks` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`detail` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`summary_json` text,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `idx_runs_owner_started` ON `runs` (`owner_id`,`started_at`);