import type { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  varchar,
  serial,
  uuid,
  json,
  integer,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

export const automation = pgTable("automation", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const automationUsers = pgTable("automation_users", {
  user_id: text("user_id").references(() => user.id),
  automation_id: integer("automation_id").references(() => automation.id),
});

export const notionDatabase = pgTable("notion_database", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const connection = pgTable("connection", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  service_id: integer("service_id").notNull(),
  user_id: text("user_id").references(() => user.id),
  user_name: text("user_name").notNull(),
  connection_oauth_id: text("connection_oauth_id"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const service = pgTable("service", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  service_key: text("service_key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const notionOAuth = pgTable("notion_oauth", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid"),
  access_token: text("access_token"),
  token_type: text("token_type"),
  notion_workspace_id: integer("notion_workspace_id")
    .notNull()
    .references(() => workspace.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const workspace = pgTable("workspace", {
  id: integer("id").primaryKey(),
  uuid: uuid("uuid").notNull().unique(),
  bot_id: uuid("bot_id"),
  notion_workspace_id: uuid("notion_workspace_id").notNull(),
  workspace_name: text("workspace_name").notNull(),
  workspace_icon: text("workspace_icon"),
  duplicated_template_id: uuid("duplicated_template_id"),
  request_id: uuid("request_id"),
  owner: json("owner"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const notionOAuthUsers = pgTable("notion_oauth_users", {
  user_id: text("user_id").references(() => user.id),
  notion_oauth_id: integer("notion_oauth_id").references(() => notionOAuth.id),
});

export const workspaceUsers = pgTable("workspace_users", {
  user_id: text("user_id").references(() => user.id),
  workspace_id: integer("workspace_id").references(() => workspace.id),
});

export type User = InferSelectModel<typeof user>;
