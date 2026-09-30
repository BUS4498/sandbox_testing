CREATE TABLE `student_setups` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`profile_text` text DEFAULT '' NOT NULL,
	`preferences_json` text DEFAULT '{}' NOT NULL,
	`confirmed_at` text,
	`updated_at` text NOT NULL
);
