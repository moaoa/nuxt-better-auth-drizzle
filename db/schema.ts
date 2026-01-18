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
  numeric,
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

export const wallet = pgTable(
  "wallet",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    balanceCredits: integer("balance_credits").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    uniqueUserId: unique().on(table.userId),
  })
);

export const creditTransaction = pgTable("credit_transaction", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["purchase", "call_charge", "refund"],
  }).notNull(),
  creditsAmount: integer("credits_amount").notNull(),
  referenceType: text("reference_type"), // 'call' | 'purchase' | null
  referenceId: text("reference_id"), // callId or purchaseId
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const call = pgTable(
  "call",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    twilioCallSid: text("twilio_call_sid").notNull(),
    fromNumber: text("from_number").notNull(),
    toNumber: text("to_number").notNull(),
    status: text("status", {
      enum: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "failed",
        "busy",
        "no-answer",
      ],
    }).notNull(),
    ratePerMinUsd: numeric("rate_per_min_usd", {
      precision: 10,
      scale: 6,
    }).notNull(),
    answeredAt: timestamp("answered_at"),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds"),
    maxAllowedSeconds: integer("max_allowed_seconds").notNull(),
    billedAt: timestamp("billed_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    uniqueTwilioCallSid: unique().on(table.twilioCallSid),
  })
);

export const callCostBreakdown = pgTable("call_cost_breakdown", {
  id: serial("id").primaryKey(),
  callId: integer("call_id")
    .notNull()
    .references(() => call.id, { onDelete: "cascade" }),
  ratePerMinUsd: numeric("rate_per_min_usd", {
    precision: 10,
    scale: 6,
  }).notNull(),
  billedMinutes: integer("billed_minutes").notNull(),
  creditsCharged: integer("credits_charged").notNull(),
  pricingSnapshot: jsonb("pricing_snapshot").default("{}").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const twilioVoiceRate = pgTable("twilio_voice_rate", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull(),
  callType: text("call_type", {
    enum: ["mobile", "landline", "toll-free"],
  }).notNull(),
  ratePerMinUsd: numeric("rate_per_min_usd", {
    precision: 10,
    scale: 6,
  }).notNull(),
  effectiveFrom: timestamp("effective_from")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const stripePayment = pgTable(
  "stripe_payment",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    walletId: integer("wallet_id")
      .notNull()
      .references(() => wallet.id, { onDelete: "cascade" }),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
    creditsAmount: integer("credits_amount").notNull(),
    status: text("status", {
      enum: ["pending", "processing", "succeeded", "failed", "canceled"],
    })
      .notNull()
      .default("pending"),
    stripeCustomerId: text("stripe_customer_id"),
    metadata: jsonb("metadata").default("{}").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    uniqueCheckoutSessionId: unique().on(table.stripeCheckoutSessionId),
    userIdIdx: unique().on(table.userId, table.stripeCheckoutSessionId),
  })
);

/* ---------- RELATIONS ---------- */

export const walletRelations = relations(wallet, ({ one, many }) => ({
  user: one(user, {
    fields: [wallet.userId],
    references: [user.id],
  }),
  creditTransactions: many(creditTransaction),
}));

export const creditTransactionRelations = relations(
  creditTransaction,
  ({ one }) => ({
    wallet: one(wallet, {
      fields: [creditTransaction.walletId],
      references: [wallet.id],
    }),
  })
);

export const callRelations = relations(call, ({ one }) => ({
  user: one(user, {
    fields: [call.userId],
    references: [user.id],
  }),
  costBreakdown: one(callCostBreakdown, {
    fields: [call.id],
    references: [callCostBreakdown.callId],
  }),
}));

export const callCostBreakdownRelations = relations(
  callCostBreakdown,
  ({ one }) => ({
    call: one(call, {
      fields: [callCostBreakdown.callId],
      references: [call.id],
    }),
  })
);

export const stripePaymentRelations = relations(
  stripePayment,
  ({ one }) => ({
    user: one(user, {
      fields: [stripePayment.userId],
      references: [user.id],
    }),
    wallet: one(wallet, {
      fields: [stripePayment.walletId],
      references: [wallet.id],
    }),
  })
);

//Types
export type User = InferSelectModel<typeof user>;
export type Wallet = InferSelectModel<typeof wallet>;
export type CreditTransaction = InferSelectModel<typeof creditTransaction>;
export type Call = InferSelectModel<typeof call>;
export type CallCostBreakdown = InferSelectModel<typeof callCostBreakdown>;
export type TwilioVoiceRate = InferSelectModel<typeof twilioVoiceRate>;
export type StripePayment = InferSelectModel<typeof stripePayment>;