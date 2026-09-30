CREATE TABLE `usage_admissions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`usage_group` text NOT NULL,
	`started_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_usage_owner_kind_started` ON `usage_admissions` (`owner_id`,`kind`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_usage_group_started` ON `usage_admissions` (`usage_group`,`started_at`);