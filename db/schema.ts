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
  unique,
  jsonb,
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

export const workspace = pgTable("workspace", {
  id: serial("id").primaryKey().notNull().unique(),
  uuid: uuid("uuid").notNull().unique(),
  bot_id: uuid("bot_id"),
  notion_workspace_id: uuid("notion_workspace_id").notNull().unique(),
  workspace_name: text("workspace_name").notNull(),
  workspace_icon: text("workspace_icon"),
  duplicated_template_id: uuid("duplicated_template_id"),
  request_id: uuid("request_id"),
  owner: json("owner"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const notionAccount = pgTable(
  "notion_account",
  {
    id: serial("id").primaryKey().notNull().unique(),
    uuid: uuid("uuid").notNull().unique(),
    user_name: text("user_name").notNull(),
    access_token: text("access_token").notNull(),
    refresh_token: text("refresh_token"),
    token_type: text("token_type").notNull(),
    revoked_at: timestamp("revoked_at"),
    workspace_id: integer("workspace_id")
      .notNull()
      .references(() => workspace.id),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    uniqueUserAndWorkspace: unique().on(table.user_id, table.workspace_id),
  })
);

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

export const notionEntity = pgTable("notion_entity", {
  id: serial("id").primaryKey().notNull().unique(),
  notionId: uuid("notion_id").notNull().unique(),
  parentId: uuid("parent_id"),
  type: text("type", { enum: ["page", "database"] }).notNull(),
  titlePlain: text("title_plain").notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdTime: timestamp("created_time").notNull(),
  lastEditedTime: timestamp("last_edited_time").notNull(),
  accountId: serial("account_id")
    .notNull()
    .references(() => notionAccount.id),
  workspaceId: serial("workspace_id")
    .notNull()
    .references(() => workspace.id),
  propertiesJson: jsonb("properties_json").default("{}").notNull(),
});

export const notionBlock = pgTable("notion_block", {
  id: serial("id").primaryKey(),
  notionId: uuid("notion_id").notNull().unique(),
  pageId: uuid("page_id")
    .notNull()
    .references(() => notionEntity.notionId),
  type: text("type").notNull(),
  position: integer("position").notNull(),
  contentJson: jsonb("content_json").default("{}").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notionDatabaseProperty = pgTable("notion_database_property", {
  id: serial("id").primaryKey(),
  databaseId: uuid("database_id")
    .notNull()
    .references(() => notionEntity.notionId),
  propName: text("prop_name").notNull(),
  propType: text("prop_type").notNull(),
  valueJson: jsonb("value_json").default("{}").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const googleSheetsAccount = pgTable(
  "google_sheets_account",
  {
    id: serial("id").primaryKey().notNull().unique(),
    uuid: uuid("uuid").notNull().unique(),
    user_name: text("user_name").notNull(),
    access_token: text("access_token").notNull(),
    refresh_token: text("refresh_token"),
    token_type: text("token_type").notNull(),
    revoked_at: timestamp("revoked_at"),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    scope: text("scope"),
    expiry_date: timestamp("expiry_date"),
  },
  (table) => ({
    uniqueUser: unique().on(table.user_id),
  })
);

/* ---------- RELATIONS ---------- */
export const notionWorkspaceRelations = relations(workspace, ({ many }) => ({
  accounts: many(notionAccount),
  entities: many(notionEntity),
}));

export const notionAccountRelations = relations(
  notionAccount,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [notionAccount.workspace_id],
      references: [workspace.id],
    }),
    entities: many(notionEntity),
    user: one(user, {
      fields: [notionAccount.user_id],
      references: [user.id],
    }),
  })
);

export const notionEntityRelations = relations(
  notionEntity,
  ({ one, many }) => ({
    workspace: one(workspace, {
      fields: [notionEntity.workspaceId],
      references: [workspace.id],
    }),
    account: one(notionAccount, {
      fields: [notionEntity.accountId],
      references: [notionAccount.id],
    }),
    blocks: many(notionBlock),
    databaseProperties: many(notionDatabaseProperty),
  })
);

export const notionBlockRelations = relations(notionBlock, ({ one }) => ({
  page: one(notionEntity, {
    fields: [notionBlock.pageId],
    references: [notionEntity.notionId],
  }),
}));

export const notionDatabasePropertyRelations = relations(
  notionDatabaseProperty,
  ({ one }) => ({
    database: one(notionEntity, {
      fields: [notionDatabaseProperty.databaseId],
      references: [notionEntity.notionId],
    }),
  })
);

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

export const googleSheetsAccountRelations = relations(
  googleSheetsAccount,
  ({ one }) => ({
    user: one(user, {
      fields: [googleSheetsAccount.user_id],
      references: [user.id],
    }),
  })
);

//Types
export type User = InferSelectModel<typeof user>;
export type NotionEntity = InferSelectModel<typeof notionEntity>;
