CREATE TABLE `auth_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email_hash` char(64),
	`ip_hash` char(64),
	`succeeded` boolean NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auth_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`job` varchar(100) NOT NULL,
	`lock_key` varchar(100),
	`status` enum('running','succeeded','failed') NOT NULL DEFAULT 'running',
	`started_at` datetime NOT NULL,
	`finished_at` datetime,
	`detail_json` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_runs_lock_key_unique` UNIQUE(`lock_key`)
);
--> statement-breakpoint
CREATE TABLE `pending_uploads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`draft_token_hash` char(64) NOT NULL,
	`storage_path` varchar(500) NOT NULL,
	`width` smallint unsigned,
	`height` smallint unsigned,
	`bytes` int unsigned,
	`content_hash` char(64) NOT NULL,
	`claimed_listing_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pending_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dealers` ADD `listing_ttl_days` smallint unsigned;--> statement-breakpoint
ALTER TABLE `listings` ADD `contact_whatsapp` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `documentation_status` enum('al_dia','transferencia_pendiente','no_declara');--> statement-breakpoint
ALTER TABLE `listings` ADD `external_ref` varchar(100);--> statement-breakpoint
ALTER TABLE `listings` ADD `manage_token_hash` char(64);--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_dealer_external_ref_unique` UNIQUE(`dealer_id`,`external_ref`);--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_manage_token_hash_unique` UNIQUE(`manage_token_hash`);--> statement-breakpoint
ALTER TABLE `pending_uploads` ADD CONSTRAINT `pending_uploads_claimed_listing_id_listings_id_fk` FOREIGN KEY (`claimed_listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auth_attempts_email_created_idx` ON `auth_attempts` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_attempts_ip_created_idx` ON `auth_attempts` (`ip_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `job_runs_job_started_idx` ON `job_runs` (`job`,`started_at`);--> statement-breakpoint
CREATE INDEX `job_runs_status_started_idx` ON `job_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE INDEX `pending_uploads_draft_token_idx` ON `pending_uploads` (`draft_token_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `pending_uploads_claimed_created_idx` ON `pending_uploads` (`claimed_listing_id`,`created_at`);