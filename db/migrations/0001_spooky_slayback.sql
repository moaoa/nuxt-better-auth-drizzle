CREATE TABLE "notion_oauth_record" (
	"id" integer PRIMARY KEY NOT NULL,
	"uuid" uuid,
	"bot_id" uuid,
	"workspace_id" uuid,
	"workspace_name" text,
	"workspace_icon" text,
	"duplicated_template_id" uuid,
	"request_id" uuid,
	"owner" json,
	"access_token" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notion_oauth_records_users" (
	"user_id" integer,
	"notion_oauth_record_id" integer
);
--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "tool" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "uuid" uuid;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "firstName";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "lastName";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";