CREATE TABLE `activity_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`entity_type` varchar(50) NOT NULL,
	`entity_id` bigint unsigned NOT NULL,
	`action` varchar(50) NOT NULL,
	`diff_json` json,
	`ip_hash` char(64),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_placements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`advertiser_name` varchar(200) NOT NULL,
	`slot_code` varchar(50) NOT NULL,
	`image_path` varchar(500),
	`target_url` varchar(500),
	`alt_text` varchar(300),
	`city_id` bigint unsigned,
	`brand_id` bigint unsigned,
	`category_id` bigint unsigned,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`amount_gs` bigint unsigned,
	`impressions` int unsigned NOT NULL DEFAULT 0,
	`clicks` int unsigned NOT NULL DEFAULT 0,
	`status` enum('draft','active','paused','expired') NOT NULL DEFAULT 'draft',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_placements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(150) NOT NULL,
	`logo_path` varchar(500),
	`intro_html` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(150) NOT NULL,
	`intro_html` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(150) NOT NULL,
	`department` varchar(120) NOT NULL,
	`is_metro_asuncion` boolean NOT NULL DEFAULT false,
	`intro_html` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `cities_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `dealer_plans` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`dealer_id` bigint unsigned NOT NULL,
	`plan_code` varchar(50) NOT NULL,
	`listing_limit` smallint unsigned,
	`monthly_price_gs` bigint unsigned NOT NULL DEFAULT 0,
	`starts_at` date NOT NULL,
	`ends_at` date,
	`status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealer_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dealers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`city_id` bigint unsigned NOT NULL,
	`address` varchar(300),
	`phone_e164` varchar(20) NOT NULL,
	`phone_raw` varchar(30) NOT NULL,
	`email` varchar(320),
	`website_url` varchar(500),
	`description` text,
	`logo_path` varchar(500),
	`status` enum('prospect','active','paused','archived') NOT NULL DEFAULT 'prospect',
	`is_verified` boolean NOT NULL DEFAULT false,
	`auto_approve` boolean NOT NULL DEFAULT false,
	`authorization_note` text,
	`authorization_date` date,
	`authorization_channel` varchar(50),
	`free_until` date,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealers_id` PRIMARY KEY(`id`),
	CONSTRAINT `dealers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `featured_purchases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`dealer_id` bigint unsigned,
	`amount_gs` bigint unsigned NOT NULL,
	`days` smallint unsigned NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`payment_method` enum('transferencia','tigo_money','billetera_personal','efectivo','cortesia') NOT NULL,
	`payment_reference` varchar(120),
	`status` enum('pending_payment','active','expired','refunded','cancelled') NOT NULL DEFAULT 'pending_payment',
	`created_by` bigint unsigned NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `featured_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`lead_id` bigint unsigned NOT NULL,
	`attempt_no` tinyint unsigned NOT NULL,
	`http_status` smallint,
	`response_body` text,
	`duration_ms` int unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lead_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type` enum('financing','insurance','dealer_plan','advertising','general') NOT NULL,
	`listing_id` bigint unsigned,
	`dealer_id` bigint unsigned,
	`name` varchar(200),
	`phone_e164` varchar(20) NOT NULL,
	`phone_raw` varchar(30) NOT NULL,
	`email` varchar(320),
	`message` text,
	`payload_json` json,
	`utm_source` varchar(200),
	`utm_medium` varchar(200),
	`utm_campaign` varchar(200),
	`utm_term` varchar(200),
	`utm_content` varchar(200),
	`gclid` varchar(200),
	`fbclid` varchar(200),
	`page_url` varchar(2000),
	`referrer` varchar(2000),
	`idempotency_key` varchar(100) NOT NULL,
	`crm_status` enum('pending','sent','duplicate','failed') NOT NULL DEFAULT 'pending',
	`crm_contact_id` varchar(100),
	`crm_deal_id` varchar(100),
	`crm_attempts` tinyint unsigned NOT NULL DEFAULT 0,
	`crm_last_error` text,
	`is_spam` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_idempotency_key_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `listing_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned,
	`event_type` enum('view','whatsapp_click','phone_reveal','share','lead_submit','favorite') NOT NULL,
	`dealer_id` bigint unsigned,
	`session_hash` char(64),
	`ip_hash` char(64),
	`user_agent_hash` char(64),
	`referrer` varchar(500),
	`page_url` varchar(500),
	`is_bot` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `listing_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listing_images` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`storage_path` varchar(500) NOT NULL,
	`width` smallint unsigned,
	`height` smallint unsigned,
	`bytes` int unsigned,
	`content_hash` char(64) NOT NULL,
	`alt_text` varchar(300),
	`is_catalog_photo` boolean NOT NULL DEFAULT false,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listing_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`public_ref` char(8) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`brand_id` bigint unsigned NOT NULL,
	`model_id` bigint unsigned,
	`model_raw` varchar(255),
	`category_id` bigint unsigned NOT NULL,
	`city_id` bigint unsigned NOT NULL,
	`dealer_id` bigint unsigned,
	`owner_user_id` bigint unsigned,
	`condition` enum('new','used') NOT NULL,
	`year` smallint unsigned,
	`mileage_km` int unsigned,
	`engine_cc` smallint unsigned,
	`price_gs` bigint unsigned,
	`has_financing_only` boolean NOT NULL DEFAULT false,
	`down_payment_gs` bigint unsigned,
	`installment_gs` bigint unsigned,
	`installment_count` smallint unsigned,
	`is_negotiable` boolean NOT NULL DEFAULT false,
	`accepts_trade_in` boolean NOT NULL DEFAULT false,
	`contact_phone_e164` varchar(20) NOT NULL,
	`contact_phone_raw` varchar(30) NOT NULL,
	`contact_name` varchar(200),
	`status` enum('draft','pending_review','published','paused','sold','expired','rejected') NOT NULL DEFAULT 'draft',
	`rejection_reason_code` varchar(50),
	`rejection_note` text,
	`published_at` datetime,
	`expires_at` datetime,
	`sold_at` datetime,
	`last_verified_at` datetime,
	`is_featured` boolean NOT NULL DEFAULT false,
	`featured_until` datetime,
	`view_count` int unsigned NOT NULL DEFAULT 0,
	`whatsapp_click_count` int unsigned NOT NULL DEFAULT 0,
	`submitted_ip` varbinary(16),
	`updated_by` bigint unsigned,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `listings_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `listings_public_ref_unique` UNIQUE(`public_ref`)
);
--> statement-breakpoint
CREATE TABLE `model_suggestions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`raw_text` varchar(255) NOT NULL,
	`brand_id` bigint unsigned,
	`listing_id` bigint unsigned,
	`status` enum('pending','mapped','created','rejected') NOT NULL DEFAULT 'pending',
	`mapped_model_id` bigint unsigned,
	`resolved_by` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`brand_id` bigint unsigned NOT NULL,
	`name` varchar(150) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`category_id` bigint unsigned,
	`engine_cc` smallint unsigned,
	`intro_html` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `models_id` PRIMARY KEY(`id`),
	CONSTRAINT `models_brand_slug_unique` UNIQUE(`brand_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` varchar(500),
	`body_html` mediumtext,
	`cover_path` varchar(500),
	`meta_title` varchar(255),
	`meta_description` varchar(500),
	`status` enum('draft','review','published') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`author_user_id` bigint unsigned,
	`reviewed_by` bigint unsigned,
	`related_brand_id` bigint unsigned,
	`related_city_id` bigint unsigned,
	`related_category_id` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`listing_id` bigint unsigned NOT NULL,
	`reason_code` varchar(50) NOT NULL,
	`detail` text,
	`reporter_phone_e164` varchar(20),
	`reporter_ip_hash` char(64),
	`status` enum('pending','reviewed','actioned','dismissed') NOT NULL DEFAULT 'pending',
	`resolved_by` bigint unsigned,
	`resolved_at` datetime,
	`resolution_note` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_alerts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`phone_e164` varchar(20),
	`email` varchar(320),
	`criteria_json` json,
	`frequency` enum('instant','daily','weekly') NOT NULL DEFAULT 'daily',
	`is_active` boolean NOT NULL DEFAULT true,
	`confirmed_at` datetime,
	`last_sent_at` datetime,
	`unsubscribe_token` char(32) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `search_alerts_unsubscribe_token_unique` UNIQUE(`unsubscribe_token`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(200) NOT NULL,
	`phone_e164` varchar(20),
	`role` enum('admin','moderator','dealer','seller') NOT NULL DEFAULT 'seller',
	`dealer_id` bigint unsigned,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`deleted_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_placements` ADD CONSTRAINT `ad_placements_city_id_cities_id_fk` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_placements` ADD CONSTRAINT `ad_placements_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_placements` ADD CONSTRAINT `ad_placements_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dealer_plans` ADD CONSTRAINT `dealer_plans_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dealers` ADD CONSTRAINT `dealers_city_id_cities_id_fk` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `featured_purchases` ADD CONSTRAINT `featured_purchases_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `featured_purchases` ADD CONSTRAINT `featured_purchases_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `featured_purchases` ADD CONSTRAINT `featured_purchases_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_deliveries` ADD CONSTRAINT `lead_deliveries_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listing_events` ADD CONSTRAINT `listing_events_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listing_events` ADD CONSTRAINT `listing_events_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listing_images` ADD CONSTRAINT `listing_images_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_model_id_models_id_fk` FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_city_id_cities_id_fk` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_suggestions` ADD CONSTRAINT `model_suggestions_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_suggestions` ADD CONSTRAINT `model_suggestions_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_suggestions` ADD CONSTRAINT `model_suggestions_mapped_model_id_models_id_fk` FOREIGN KEY (`mapped_model_id`) REFERENCES `models`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `model_suggestions` ADD CONSTRAINT `model_suggestions_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `models` ADD CONSTRAINT `models_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `models` ADD CONSTRAINT `models_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_related_brand_id_brands_id_fk` FOREIGN KEY (`related_brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_related_city_id_cities_id_fk` FOREIGN KEY (`related_city_id`) REFERENCES `cities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_related_category_id_categories_id_fk` FOREIGN KEY (`related_category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_listing_id_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_log_entity_created_idx` ON `activity_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_log_user_created_idx` ON `activity_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ad_placements_slot_status_dates_idx` ON `ad_placements` (`slot_code`,`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `cities_active_sort_idx` ON `cities` (`is_active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `dealers_status_idx` ON `dealers` (`status`);--> statement-breakpoint
CREATE INDEX `dealers_city_id_idx` ON `dealers` (`city_id`);--> statement-breakpoint
CREATE INDEX `featured_purchases_listing_status_idx` ON `featured_purchases` (`listing_id`,`status`);--> statement-breakpoint
CREATE INDEX `featured_purchases_status_ends_idx` ON `featured_purchases` (`status`,`ends_at`);--> statement-breakpoint
CREATE INDEX `leads_crm_status_created_idx` ON `leads` (`crm_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_type_created_idx` ON `leads` (`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_dealer_created_idx` ON `leads` (`dealer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_events_listing_type_created_idx` ON `listing_events` (`listing_id`,`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_events_dealer_type_created_idx` ON `listing_events` (`dealer_id`,`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_events_type_created_idx` ON `listing_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `listing_images_listing_sort_idx` ON `listing_images` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `listing_images_content_hash_idx` ON `listing_images` (`content_hash`);--> statement-breakpoint
CREATE INDEX `listings_status_published_idx` ON `listings` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `listings_status_featured_published_idx` ON `listings` (`status`,`is_featured`,`published_at`);--> statement-breakpoint
CREATE INDEX `listings_brand_model_status_idx` ON `listings` (`brand_id`,`model_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_city_status_idx` ON `listings` (`city_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_category_status_idx` ON `listings` (`category_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_dealer_status_idx` ON `listings` (`dealer_id`,`status`);--> statement-breakpoint
CREATE INDEX `listings_status_price_idx` ON `listings` (`status`,`price_gs`);--> statement-breakpoint
CREATE INDEX `listings_status_expires_idx` ON `listings` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `listings_model_status_price_idx` ON `listings` (`model_id`,`status`,`price_gs`);--> statement-breakpoint
CREATE INDEX `models_brand_active_idx` ON `models` (`brand_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `models_category_id_idx` ON `models` (`category_id`);--> statement-breakpoint
CREATE INDEX `posts_status_published_idx` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_listing_id_idx` ON `reports` (`listing_id`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_dealer_id_idx` ON `users` (`dealer_id`);--> statement-breakpoint
-- drizzle-kit no genera índices FULLTEXT; se agrega a mano (DATABASE_SCHEMA.md §2.6).
CREATE FULLTEXT INDEX `listings_title_description_fulltext` ON `listings` (`title`,`description`);