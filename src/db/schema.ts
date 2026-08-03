import { relations, sql } from "drizzle-orm";
import {
  type AnyMySqlColumn,
  bigint,
  boolean,
  char,
  date,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varbinary,
  varchar,
  mediumtext,
} from "drizzle-orm/mysql-core";

// Convenciones globales: ver DATABASE_SCHEMA.md.
// snake_case en inglés para el esquema; created_at/updated_at en toda tabla;
// deleted_at para borrado lógico donde se indica; dinero en Gs. como entero (ADR-06).

const timestamps = {
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
};

// ---------------------------------------------------------------------------
// 2.1 users
// ---------------------------------------------------------------------------

export const userRoleEnum = ["admin", "moderator", "dealer", "seller"] as const;

export const users = mysqlTable(
  "users",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    phoneE164: varchar("phone_e164", { length: 20 }),
    role: mysqlEnum("role", userRoleEnum).notNull().default("seller"),
    dealerId: bigint("dealer_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => dealers.id,
    ),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at", { mode: "date" }),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_dealer_id_idx").on(table.dealerId),
  ],
);

// ---------------------------------------------------------------------------
// 2.2 dealers
// ---------------------------------------------------------------------------

export const dealerStatusEnum = ["prospect", "active", "paused", "archived"] as const;

export const dealers = mysqlTable(
  "dealers",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    cityId: bigint("city_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => cities.id),
    address: varchar("address", { length: 300 }),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    phoneRaw: varchar("phone_raw", { length: 30 }).notNull(),
    email: varchar("email", { length: 320 }),
    websiteUrl: varchar("website_url", { length: 500 }),
    description: text("description"),
    logoPath: varchar("logo_path", { length: 500 }),
    status: mysqlEnum("status", dealerStatusEnum).notNull().default("prospect"),
    isVerified: boolean("is_verified").notNull().default(false),
    autoApprove: boolean("auto_approve").notNull().default(false),
    authorizationNote: text("authorization_note"),
    authorizationDate: date("authorization_date", { mode: "string" }),
    authorizationChannel: varchar("authorization_channel", { length: 50 }),
    freeUntil: date("free_until", { mode: "string" }),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("dealers_slug_unique").on(table.slug),
    index("dealers_status_idx").on(table.status),
    index("dealers_city_id_idx").on(table.cityId),
  ],
);

// ---------------------------------------------------------------------------
// 2.3 cities
// ---------------------------------------------------------------------------

export const cities = mysqlTable(
  "cities",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    department: varchar("department", { length: 120 }).notNull(),
    isMetroAsuncion: boolean("is_metro_asuncion").notNull().default(false),
    introHtml: text("intro_html"),
    sortOrder: int("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cities_slug_unique").on(table.slug),
    index("cities_active_sort_idx").on(table.isActive, table.sortOrder),
  ],
);

// ---------------------------------------------------------------------------
// 2.4 brands, models, model_suggestions
// ---------------------------------------------------------------------------

export const brands = mysqlTable(
  "brands",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    logoPath: varchar("logo_path", { length: 500 }),
    introHtml: text("intro_html"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("brands_slug_unique").on(table.slug)],
);

export const models = mysqlTable(
  "models",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    brandId: bigint("brand_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => brands.id),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    categoryId: bigint("category_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => categories.id,
    ),
    engineCc: smallint("engine_cc", { unsigned: true }),
    introHtml: text("intro_html"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("models_brand_slug_unique").on(table.brandId, table.slug),
    index("models_brand_active_idx").on(table.brandId, table.isActive),
    index("models_category_id_idx").on(table.categoryId),
  ],
);

export const modelSuggestionStatusEnum = [
  "pending",
  "mapped",
  "created",
  "rejected",
] as const;

export const modelSuggestions = mysqlTable("model_suggestions", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  rawText: varchar("raw_text", { length: 255 }).notNull(),
  brandId: bigint("brand_id", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => brands.id,
  ),
  listingId: bigint("listing_id", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => listings.id,
  ),
  status: mysqlEnum("status", modelSuggestionStatusEnum).notNull().default("pending"),
  mappedModelId: bigint("mapped_model_id", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => models.id,
  ),
  resolvedBy: bigint("resolved_by", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => users.id,
  ),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// 2.5 categories
// ---------------------------------------------------------------------------

export const categories = mysqlTable(
  "categories",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull(),
    introHtml: text("intro_html"),
    sortOrder: int("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("categories_slug_unique").on(table.slug)],
);

// ---------------------------------------------------------------------------
// 2.6 listings
// ---------------------------------------------------------------------------

export const listingConditionEnum = ["new", "used"] as const;
export const listingStatusEnum = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "sold",
  "expired",
  "rejected",
] as const;

export const listings = mysqlTable(
  "listings",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    publicRef: char("public_ref", { length: 8 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    brandId: bigint("brand_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => brands.id),
    modelId: bigint("model_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => models.id,
    ),
    modelRaw: varchar("model_raw", { length: 255 }),
    categoryId: bigint("category_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => categories.id),
    cityId: bigint("city_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => cities.id),
    dealerId: bigint("dealer_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => dealers.id,
    ),
    ownerUserId: bigint("owner_user_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    condition: mysqlEnum("condition", listingConditionEnum).notNull(),
    year: smallint("year", { unsigned: true }),
    mileageKm: int("mileage_km", { unsigned: true }),
    engineCc: smallint("engine_cc", { unsigned: true }),
    priceGs: bigint("price_gs", { mode: "number", unsigned: true }),
    hasFinancingOnly: boolean("has_financing_only").notNull().default(false),
    downPaymentGs: bigint("down_payment_gs", { mode: "number", unsigned: true }),
    installmentGs: bigint("installment_gs", { mode: "number", unsigned: true }),
    installmentCount: smallint("installment_count", { unsigned: true }),
    isNegotiable: boolean("is_negotiable").notNull().default(false),
    acceptsTradeIn: boolean("accepts_trade_in").notNull().default(false),
    contactPhoneE164: varchar("contact_phone_e164", { length: 20 }).notNull(),
    contactPhoneRaw: varchar("contact_phone_raw", { length: 30 }).notNull(),
    contactName: varchar("contact_name", { length: 200 }),
    status: mysqlEnum("status", listingStatusEnum).notNull().default("draft"),
    rejectionReasonCode: varchar("rejection_reason_code", { length: 50 }),
    rejectionNote: text("rejection_note"),
    publishedAt: datetime("published_at", { mode: "date" }),
    expiresAt: datetime("expires_at", { mode: "date" }),
    soldAt: datetime("sold_at", { mode: "date" }),
    lastVerifiedAt: datetime("last_verified_at", { mode: "date" }),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredUntil: datetime("featured_until", { mode: "date" }),
    viewCount: int("view_count", { unsigned: true }).notNull().default(0),
    whatsappClickCount: int("whatsapp_click_count", { unsigned: true }).notNull().default(0),
    submittedIp: varbinary("submitted_ip", { length: 16 }),
    updatedBy: bigint("updated_by", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    deletedAt: datetime("deleted_at", { mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("listings_slug_unique").on(table.slug),
    uniqueIndex("listings_public_ref_unique").on(table.publicRef),
    index("listings_status_published_idx").on(table.status, table.publishedAt),
    index("listings_status_featured_published_idx").on(
      table.status,
      table.isFeatured,
      table.publishedAt,
    ),
    index("listings_brand_model_status_idx").on(table.brandId, table.modelId, table.status),
    index("listings_city_status_idx").on(table.cityId, table.status),
    index("listings_category_status_idx").on(table.categoryId, table.status),
    index("listings_dealer_status_idx").on(table.dealerId, table.status),
    index("listings_status_price_idx").on(table.status, table.priceGs),
    index("listings_status_expires_idx").on(table.status, table.expiresAt),
    index("listings_model_status_price_idx").on(table.modelId, table.status, table.priceGs),
  ],
);

// ---------------------------------------------------------------------------
// 2.7 listing_images
// ---------------------------------------------------------------------------

export const listingImages = mysqlTable(
  "listing_images",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    listingId: bigint("listing_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => listings.id, { onDelete: "cascade" }),
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    width: smallint("width", { unsigned: true }),
    height: smallint("height", { unsigned: true }),
    bytes: int("bytes", { unsigned: true }),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    altText: varchar("alt_text", { length: 300 }),
    isCatalogPhoto: boolean("is_catalog_photo").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("listing_images_listing_sort_idx").on(table.listingId, table.sortOrder),
    index("listing_images_content_hash_idx").on(table.contentHash),
  ],
);

// ---------------------------------------------------------------------------
// 2.8 listing_events
// ---------------------------------------------------------------------------

export const listingEventTypeEnum = [
  "view",
  "whatsapp_click",
  "phone_reveal",
  "share",
  "lead_submit",
  "favorite",
] as const;

export const listingEvents = mysqlTable(
  "listing_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    listingId: bigint("listing_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => listings.id,
    ),
    eventType: mysqlEnum("event_type", listingEventTypeEnum).notNull(),
    dealerId: bigint("dealer_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => dealers.id,
    ),
    sessionHash: char("session_hash", { length: 64 }),
    ipHash: char("ip_hash", { length: 64 }),
    userAgentHash: char("user_agent_hash", { length: 64 }),
    referrer: varchar("referrer", { length: 500 }),
    pageUrl: varchar("page_url", { length: 500 }),
    isBot: boolean("is_bot").notNull().default(false),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("listing_events_listing_type_created_idx").on(
      table.listingId,
      table.eventType,
      table.createdAt,
    ),
    index("listing_events_dealer_type_created_idx").on(
      table.dealerId,
      table.eventType,
      table.createdAt,
    ),
    index("listing_events_type_created_idx").on(table.eventType, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 2.9 leads, lead_deliveries
// ---------------------------------------------------------------------------

export const leadTypeEnum = [
  "financing",
  "insurance",
  "dealer_plan",
  "advertising",
  "general",
] as const;
export const leadCrmStatusEnum = ["pending", "sent", "duplicate", "failed"] as const;

export const leads = mysqlTable(
  "leads",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    type: mysqlEnum("type", leadTypeEnum).notNull(),
    listingId: bigint("listing_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => listings.id,
    ),
    dealerId: bigint("dealer_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => dealers.id,
    ),
    name: varchar("name", { length: 200 }),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    phoneRaw: varchar("phone_raw", { length: 30 }).notNull(),
    email: varchar("email", { length: 320 }),
    message: text("message"),
    payloadJson: json("payload_json"),
    utmSource: varchar("utm_source", { length: 200 }),
    utmMedium: varchar("utm_medium", { length: 200 }),
    utmCampaign: varchar("utm_campaign", { length: 200 }),
    utmTerm: varchar("utm_term", { length: 200 }),
    utmContent: varchar("utm_content", { length: 200 }),
    gclid: varchar("gclid", { length: 200 }),
    fbclid: varchar("fbclid", { length: 200 }),
    pageUrl: varchar("page_url", { length: 2000 }),
    referrer: varchar("referrer", { length: 2000 }),
    idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
    crmStatus: mysqlEnum("crm_status", leadCrmStatusEnum).notNull().default("pending"),
    crmContactId: varchar("crm_contact_id", { length: 100 }),
    crmDealId: varchar("crm_deal_id", { length: 100 }),
    crmAttempts: tinyint("crm_attempts", { unsigned: true }).notNull().default(0),
    crmLastError: text("crm_last_error"),
    isSpam: boolean("is_spam").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("leads_idempotency_key_unique").on(table.idempotencyKey),
    index("leads_crm_status_created_idx").on(table.crmStatus, table.createdAt),
    index("leads_type_created_idx").on(table.type, table.createdAt),
    index("leads_dealer_created_idx").on(table.dealerId, table.createdAt),
  ],
);

export const leadDeliveries = mysqlTable("lead_deliveries", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  leadId: bigint("lead_id", { mode: "number", unsigned: true })
    .notNull()
    .references((): AnyMySqlColumn => leads.id),
  attemptNo: tinyint("attempt_no", { unsigned: true }).notNull(),
  httpStatus: smallint("http_status"),
  responseBody: text("response_body"),
  durationMs: int("duration_ms", { unsigned: true }),
  createdAt: datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

// ---------------------------------------------------------------------------
// 2.10 featured_purchases, dealer_plans, ad_placements
// ---------------------------------------------------------------------------

export const paymentMethodEnum = [
  "transferencia",
  "tigo_money",
  "billetera_personal",
  "efectivo",
  "cortesia",
] as const;
export const featuredPurchaseStatusEnum = [
  "pending_payment",
  "active",
  "expired",
  "refunded",
  "cancelled",
] as const;

export const featuredPurchases = mysqlTable(
  "featured_purchases",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    listingId: bigint("listing_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => listings.id),
    dealerId: bigint("dealer_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => dealers.id,
    ),
    amountGs: bigint("amount_gs", { mode: "number", unsigned: true }).notNull(),
    days: smallint("days", { unsigned: true }).notNull(),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    paymentMethod: mysqlEnum("payment_method", paymentMethodEnum).notNull(),
    paymentReference: varchar("payment_reference", { length: 120 }),
    status: mysqlEnum("status", featuredPurchaseStatusEnum)
      .notNull()
      .default("pending_payment"),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => users.id),
    ...timestamps,
  },
  (table) => [
    index("featured_purchases_listing_status_idx").on(table.listingId, table.status),
    index("featured_purchases_status_ends_idx").on(table.status, table.endsAt),
  ],
);

export const dealerPlanStatusEnum = ["active", "expired", "cancelled"] as const;

export const dealerPlans = mysqlTable("dealer_plans", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  dealerId: bigint("dealer_id", { mode: "number", unsigned: true })
    .notNull()
    .references((): AnyMySqlColumn => dealers.id),
  planCode: varchar("plan_code", { length: 50 }).notNull(),
  listingLimit: smallint("listing_limit", { unsigned: true }),
  monthlyPriceGs: bigint("monthly_price_gs", { mode: "number", unsigned: true })
    .notNull()
    .default(0),
  startsAt: date("starts_at", { mode: "string" }).notNull(),
  endsAt: date("ends_at", { mode: "string" }),
  status: mysqlEnum("status", dealerPlanStatusEnum).notNull().default("active"),
  notes: text("notes"),
  ...timestamps,
});

export const adPlacementStatusEnum = ["draft", "active", "paused", "expired"] as const;

export const adPlacements = mysqlTable(
  "ad_placements",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    advertiserName: varchar("advertiser_name", { length: 200 }).notNull(),
    slotCode: varchar("slot_code", { length: 50 }).notNull(),
    imagePath: varchar("image_path", { length: 500 }),
    targetUrl: varchar("target_url", { length: 500 }),
    altText: varchar("alt_text", { length: 300 }),
    cityId: bigint("city_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => cities.id,
    ),
    brandId: bigint("brand_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => brands.id,
    ),
    categoryId: bigint("category_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => categories.id,
    ),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    amountGs: bigint("amount_gs", { mode: "number", unsigned: true }),
    impressions: int("impressions", { unsigned: true }).notNull().default(0),
    clicks: int("clicks", { unsigned: true }).notNull().default(0),
    status: mysqlEnum("status", adPlacementStatusEnum).notNull().default("draft"),
    ...timestamps,
  },
  (table) => [
    index("ad_placements_slot_status_dates_idx").on(
      table.slotCode,
      table.status,
      table.startsAt,
      table.endsAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 2.11 reports
// ---------------------------------------------------------------------------

export const reportStatusEnum = ["pending", "reviewed", "actioned", "dismissed"] as const;

export const reports = mysqlTable(
  "reports",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    listingId: bigint("listing_id", { mode: "number", unsigned: true })
      .notNull()
      .references((): AnyMySqlColumn => listings.id),
    reasonCode: varchar("reason_code", { length: 50 }).notNull(),
    detail: text("detail"),
    reporterPhoneE164: varchar("reporter_phone_e164", { length: 20 }),
    reporterIpHash: char("reporter_ip_hash", { length: 64 }),
    status: mysqlEnum("status", reportStatusEnum).notNull().default("pending"),
    resolvedBy: bigint("resolved_by", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    resolvedAt: datetime("resolved_at", { mode: "date" }),
    resolutionNote: text("resolution_note"),
    ...timestamps,
  },
  (table) => [
    index("reports_status_created_idx").on(table.status, table.createdAt),
    index("reports_listing_id_idx").on(table.listingId),
  ],
);

// ---------------------------------------------------------------------------
// 2.12 posts
// ---------------------------------------------------------------------------

export const postStatusEnum = ["draft", "review", "published"] as const;

export const posts = mysqlTable(
  "posts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    excerpt: varchar("excerpt", { length: 500 }),
    bodyHtml: mediumtext("body_html"),
    coverPath: varchar("cover_path", { length: 500 }),
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: varchar("meta_description", { length: 500 }),
    status: mysqlEnum("status", postStatusEnum).notNull().default("draft"),
    publishedAt: datetime("published_at", { mode: "date" }),
    authorUserId: bigint("author_user_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    reviewedBy: bigint("reviewed_by", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    relatedBrandId: bigint("related_brand_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => brands.id,
    ),
    relatedCityId: bigint("related_city_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => cities.id,
    ),
    relatedCategoryId: bigint("related_category_id", {
      mode: "number",
      unsigned: true,
    }).references((): AnyMySqlColumn => categories.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("posts_slug_unique").on(table.slug),
    index("posts_status_published_idx").on(table.status, table.publishedAt),
  ],
);

// ---------------------------------------------------------------------------
// 2.13 activity_log
// ---------------------------------------------------------------------------

export const activityLog = mysqlTable(
  "activity_log",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).references(
      (): AnyMySqlColumn => users.id,
    ),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: bigint("entity_id", { mode: "number", unsigned: true }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    diffJson: json("diff_json"),
    ipHash: char("ip_hash", { length: 64 }),
    createdAt: datetime("created_at", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("activity_log_entity_created_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
    index("activity_log_user_created_idx").on(table.userId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// 2.14 search_alerts (fase 3, tabla creada ahora para no cambiar el esquema después)
// ---------------------------------------------------------------------------

export const searchAlertFrequencyEnum = ["instant", "daily", "weekly"] as const;

export const searchAlerts = mysqlTable(
  "search_alerts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    phoneE164: varchar("phone_e164", { length: 20 }),
    email: varchar("email", { length: 320 }),
    criteriaJson: json("criteria_json"),
    frequency: mysqlEnum("frequency", searchAlertFrequencyEnum).notNull().default("daily"),
    isActive: boolean("is_active").notNull().default(true),
    confirmedAt: datetime("confirmed_at", { mode: "date" }),
    lastSentAt: datetime("last_sent_at", { mode: "date" }),
    unsubscribeToken: char("unsubscribe_token", { length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("search_alerts_unsubscribe_token_unique").on(table.unsubscribeToken),
  ],
);

// ---------------------------------------------------------------------------
// Relaciones (para queries anidados con Drizzle; no afectan el DDL)
// ---------------------------------------------------------------------------

export const listingsRelations = relations(listings, ({ one, many }) => ({
  brand: one(brands, { fields: [listings.brandId], references: [brands.id] }),
  model: one(models, { fields: [listings.modelId], references: [models.id] }),
  category: one(categories, { fields: [listings.categoryId], references: [categories.id] }),
  city: one(cities, { fields: [listings.cityId], references: [cities.id] }),
  dealer: one(dealers, { fields: [listings.dealerId], references: [dealers.id] }),
  images: many(listingImages),
}));

export const listingImagesRelations = relations(listingImages, ({ one }) => ({
  listing: one(listings, { fields: [listingImages.listingId], references: [listings.id] }),
}));

export const modelsRelations = relations(models, ({ one, many }) => ({
  brand: one(brands, { fields: [models.brandId], references: [brands.id] }),
  category: one(categories, { fields: [models.categoryId], references: [categories.id] }),
  listings: many(listings),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  models: many(models),
}));

export const dealersRelations = relations(dealers, ({ one, many }) => ({
  city: one(cities, { fields: [dealers.cityId], references: [cities.id] }),
  listings: many(listings),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  listing: one(listings, { fields: [leads.listingId], references: [listings.id] }),
  dealer: one(dealers, { fields: [leads.dealerId], references: [dealers.id] }),
  deliveries: many(leadDeliveries),
}));

export const leadDeliveriesRelations = relations(leadDeliveries, ({ one }) => ({
  lead: one(leads, { fields: [leadDeliveries.leadId], references: [leads.id] }),
}));
