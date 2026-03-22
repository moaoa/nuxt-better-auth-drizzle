CREATE TABLE "call" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"twilio_call_sid" text NOT NULL,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"status" text NOT NULL,
	"rate_per_min_usd" numeric(10, 6) NOT NULL,
	"answered_at" timestamp,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"max_allowed_seconds" integer NOT NULL,
	"billed_at" timestamp,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "call_twilio_call_sid_unique" UNIQUE("twilio_call_sid")
);
--> statement-breakpoint
CREATE TABLE "call_cost_breakdown" (
	"id" serial PRIMARY KEY NOT NULL,
	"call_id" integer NOT NULL,
	"rate_per_min_usd" numeric(10, 6) NOT NULL,
	"billed_minutes" integer NOT NULL,
	"twilio_price_usd" numeric(10, 6),
	"twilio_price_unit" text,
	"user_price_usd" numeric(10, 6),
	"profit_margin" numeric(5, 4),
	"twilio_duration_seconds" integer,
	"pricing_snapshot" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "now_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" integer NOT NULL,
	"nowpayments_invoice_id" text,
	"nowpayments_payment_id" text,
	"invoice_url" text,
	"amount_usd" numeric(10, 2) NOT NULL,
	"pay_currency" text,
	"pay_amount" numeric(20, 10),
	"actually_paid" numeric(20, 10),
	"outcome_amount" numeric(10, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "stripe_payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"wallet_id" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"amount_usd" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_customer_id" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "stripe_payment_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "stripe_payment_user_id_stripe_checkout_session_id_unique" UNIQUE("user_id","stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount_usd" numeric(10, 2) NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twilio_voice_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"call_type" text NOT NULL,
	"rate_per_min_usd" numeric(10, 6) NOT NULL,
	"effective_from" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance_usd" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "wallet_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DROP TABLE "notion_oauth" CASCADE;--> statement-breakpoint
DROP TABLE "notion_oauth_users" CASCADE;--> statement-breakpoint
DROP TABLE "workspace" CASCADE;--> statement-breakpoint
DROP TABLE "workspace_users" CASCADE;--> statement-breakpoint
ALTER TABLE "call" ADD CONSTRAINT "call_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_cost_breakdown" ADD CONSTRAINT "call_cost_breakdown_call_id_call_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."call"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "now_payment" ADD CONSTRAINT "now_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "now_payment" ADD CONSTRAINT "now_payment_wallet_id_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment" ADD CONSTRAINT "stripe_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payment" ADD CONSTRAINT "stripe_payment_wallet_id_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_wallet_id_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;