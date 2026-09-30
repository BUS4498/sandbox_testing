CREATE TABLE `student_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`opportunity_version` integer NOT NULL,
	`response_type` text NOT NULL,
	`response_text` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text,
	`error_code` text
);
--> statement-breakpoint
CREATE INDEX `idx_student_responses_owner_opportunity` ON `student_responses` (`owner_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `runs` ADD `kind` text DEFAULT 'COLLECTION' NOT NULL;