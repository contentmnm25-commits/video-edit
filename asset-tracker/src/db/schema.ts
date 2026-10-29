import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "designer", "reviewer", "member", "viewer"]);
export const teamEnum = pgEnum("team", [
  "design",
  "marketing",
  "content",
  "listing",
  "qcom",
  "ecom",
  "other",
]);
export const assetTypeEnum = pgEnum("asset_type", [
  "image",
  "video",
  "a_plus",
  "banner",
  "social",
  "other",
]);
export const assetStatusEnum = pgEnum("asset_status", [
  "in_progress",
  "in_review",
  "ready",
  "needs_correction",
]);
export const reviewStateEnum = pgEnum("review_state", ["pending", "approved", "rejected"]);
export const requestTypeEnum = pgEnum("request_type", ["new_creative", "correction"]);
export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "in_progress",
  "done",
  "cancelled",
]);
export const priorityEnum = pgEnum("priority", ["low", "normal", "high", "urgent"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  role: roleEnum("role").notNull().default("member"),
  team: teamEnum("team"),
  active: boolean("active").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token; the raw token never touches the database
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // What the channel calls a listing id: ASIN, FSN, Item ID...
  idLabel: text("id_label"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// Channels a person is responsible for; drives "your queue" and notifications.
export const userChannels = pgTable(
  "user_channels",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.channelId] })],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sku: text("sku").notNull().unique(),
    brand: text("brand"),
    category: text("category"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_name_idx").on(t.name)],
);

// The product's listing id on each channel (ASIN on Amazon, FSN on Flipkart...).
export const productChannels = pgTable(
  "product_channels",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.channelId] })],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull().default("image"),
    status: assetStatusEnum("status").notNull().default("in_progress"),
    // Latest approved version. This is what every channel should be showing.
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => versions.id, {
      onDelete: "set null",
    }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    archived: boolean("archived").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("assets_product_name_idx").on(t.productId, t.name),
    index("assets_status_idx").on(t.status),
    index("assets_updated_idx").on(t.updatedAt),
  ],
);

// Which channels an asset is used on, and which version each one is showing.
export const assetChannels = pgTable(
  "asset_channels",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    liveVersionId: uuid("live_version_id").references((): AnyPgColumn => versions.id, {
      onDelete: "set null",
    }),
    liveAt: timestamp("live_at", { withTimezone: true }),
    liveById: uuid("live_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.assetId, t.channelId] }),
    index("asset_channels_channel_idx").on(t.channelId),
  ],
);

export const versions = pgTable(
  "versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSec: real("duration_sec"),
    thumbKey: text("thumb_key"),
    note: text("note").notNull(),
    review: reviewStateEnum("review").notNull().default("approved"),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("versions_asset_number_idx").on(t.assetId, t.number)],
);

export const requests = pgTable(
  "requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: requestTypeEnum("type").notNull(),
    status: requestStatusEnum("status").notNull().default("open"),
    priority: priorityEnum("priority").notNull().default("normal"),
    title: text("title").notNull(),
    description: text("description"),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
    requestedById: uuid("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    resolvedVersionId: uuid("resolved_version_id").references(() => versions.id, {
      onDelete: "set null",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("requests_status_idx").on(t.status), index("requests_asset_idx").on(t.assetId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => versions.id, { onDelete: "set null" }),
    requestId: uuid("request_id").references(() => requests.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_asset_idx").on(t.assetId), index("comments_request_idx").on(t.requestId)],
);

// Append-only audit log of everything that happened.
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => assets.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => versions.id, { onDelete: "set null" }),
    channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
    requestId: uuid("request_id").references(() => requests.id, { onDelete: "cascade" }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_created_idx").on(t.createdAt), index("activity_asset_idx").on(t.assetId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// ─── Relations (for db.query.*) ─────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  channels: many(userChannels),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  users: many(userChannels),
}));

export const userChannelsRelations = relations(userChannels, ({ one }) => ({
  user: one(users, { fields: [userChannels.userId], references: [users.id] }),
  channel: one(channels, { fields: [userChannels.channelId], references: [channels.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  assets: many(assets),
  channelIds: many(productChannels),
}));

export const productChannelsRelations = relations(productChannels, ({ one }) => ({
  product: one(products, { fields: [productChannels.productId], references: [products.id] }),
  channel: one(channels, { fields: [productChannels.channelId], references: [channels.id] }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  product: one(products, { fields: [assets.productId], references: [products.id] }),
  currentVersion: one(versions, {
    fields: [assets.currentVersionId],
    references: [versions.id],
    relationName: "current_version",
  }),
  assignee: one(users, { fields: [assets.assigneeId], references: [users.id] }),
  versions: many(versions, { relationName: "asset_versions" }),
  channels: many(assetChannels),
}));

export const assetChannelsRelations = relations(assetChannels, ({ one }) => ({
  asset: one(assets, { fields: [assetChannels.assetId], references: [assets.id] }),
  channel: one(channels, { fields: [assetChannels.channelId], references: [channels.id] }),
  liveVersion: one(versions, {
    fields: [assetChannels.liveVersionId],
    references: [versions.id],
  }),
  liveBy: one(users, { fields: [assetChannels.liveById], references: [users.id] }),
}));

export const versionsRelations = relations(versions, ({ one }) => ({
  asset: one(assets, {
    fields: [versions.assetId],
    references: [assets.id],
    relationName: "asset_versions",
  }),
  uploadedBy: one(users, {
    fields: [versions.uploadedById],
    references: [users.id],
    relationName: "uploader",
  }),
  reviewedBy: one(users, {
    fields: [versions.reviewedById],
    references: [users.id],
    relationName: "reviewer",
  }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  product: one(products, { fields: [requests.productId], references: [products.id] }),
  asset: one(assets, { fields: [requests.assetId], references: [assets.id] }),
  requestedBy: one(users, {
    fields: [requests.requestedById],
    references: [users.id],
    relationName: "requester",
  }),
  assignee: one(users, {
    fields: [requests.assigneeId],
    references: [users.id],
    relationName: "request_assignee",
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  version: one(versions, { fields: [comments.versionId], references: [versions.id] }),
}));

export const activityRelations = relations(activity, ({ one }) => ({
  actor: one(users, { fields: [activity.actorId], references: [users.id] }),
  asset: one(assets, { fields: [activity.assetId], references: [assets.id] }),
  product: one(products, { fields: [activity.productId], references: [products.id] }),
  version: one(versions, { fields: [activity.versionId], references: [versions.id] }),
  channel: one(channels, { fields: [activity.channelId], references: [channels.id] }),
}));

export type User = typeof users.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Team = (typeof teamEnum.enumValues)[number];
export type AssetType = (typeof assetTypeEnum.enumValues)[number];
export type AssetStatus = (typeof assetStatusEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type RequestType = (typeof requestTypeEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
