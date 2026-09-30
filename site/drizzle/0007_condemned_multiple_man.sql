CREATE TABLE `owner_pairing_attempts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_owner_identity` (
	`slot` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`verified_at` text NOT NULL
);
