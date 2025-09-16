import { relations, type InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  json,
  serial,
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
  id: serial("id").primaryKey().notNull().unique(),
  uuid: uuid("uuid").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id),
  service_id: serial("service_id")
    .notNull()
    .references(() => service.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const notionEntities = pgTable("notion_entities", {
  id: serial("id").primaryKey().notNull().unique(),
  uuid: uuid("uuid").notNull().unique(),
  notion_entity_uuid: uuid("notion_entity_uuid").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  parent_id: text("parent_id"),
  //TODO: check if we want to store teh workspace id or remove it all together
  is_child_of_workspace: boolean("is_child_of_workspace")
    .notNull()
    .default(false),
  notion_account_id: serial("notion_account_id")
    .notNull()
    .references(() => notionAccount.id),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id),
  service_id: serial("service_id")
    .notNull()
    .references(() => service.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const workspace = pgTable("workspace", {
  id: serial("id").primaryKey().notNull().unique(),
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

export const notionAccount = pgTable("notion_account", {
  id: serial("id").primaryKey().notNull().unique(),
  uuid: uuid("uuid").notNull().unique(),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id),
  user_name: text("user_name").notNull(),
  access_token: text("access_token").notNull(),
  refresh_token: text("refresh_token"),
  token_type: text("token_type").notNull(),
  revoked_at: timestamp("revoked_at"),
  workspace_id: integer("workspace_id")
    .notNull()
    .references(() => workspace.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const service = pgTable("service", {
  id: serial("id").primaryKey().notNull().unique(),
  uuid: uuid("uuid").notNull().unique(),
  service_key: text("service_key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  disabled: boolean("disabled").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export type User = InferSelectModel<typeof user>;

export const notionEntitiesRelations = relations(notionEntities, ({ one }) => ({
  parent: one(notionEntities, {
    fields: [notionEntities.parent_id],
    references: [notionEntities.id],
  }),
}));

export const notionAccountRelations = relations(notionAccount, ({ one }) => ({
  workspace: one(workspace, {
    fields: [notionAccount.workspace_id],
    references: [workspace.id],
  }),
  user: one(user, {
    fields: [notionAccount.user_id],
    references: [user.id],
  }),
}));

export const serviceRelations = relations(service, ({ many }) => ({
  notionAccounts: many(notionAccount, {
    relationName: "notionAccounts",
  }),
}));

export const workspaceRelations = relations(workspace, ({ many }) => ({
  notionAccounts: many(notionAccount, {
    relationName: "notionAccounts",
  }),
}));
