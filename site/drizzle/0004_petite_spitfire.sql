CREATE TABLE `daily_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`local_date` text NOT NULL,
	`github_run_id` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL,
	`collection_run_id` text,
	`started_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_attempt_owner_date` ON `daily_attempts` (`owner_id`,`local_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_attempt_github_run_id` ON `daily_attempts` (`github_run_id`);--> statement-breakpoint
CREATE INDEX `idx_daily_attempt_owner_started` ON `daily_attempts` (`owner_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `daily_schedules` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`token_hash` text,
	`connected_at` text,
	`enabled_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_schedule_token_hash` ON `daily_schedules` (`token_hash`);