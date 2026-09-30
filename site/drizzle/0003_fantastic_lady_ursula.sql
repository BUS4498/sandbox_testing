CREATE TABLE `application_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`request_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`placeholders_json` text NOT NULL,
	`opportunity_version` integer NOT NULL,
	`profile_mode` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_materials_owner_request_type` ON `application_materials` (`owner_id`,`request_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_materials_owner_opportunity_created` ON `application_materials` (`owner_id`,`opportunity_id`,`created_at`);