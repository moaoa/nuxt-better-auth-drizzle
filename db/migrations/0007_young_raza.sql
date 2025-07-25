ALTER TABLE "notion_oauth_record" DROP CONSTRAINT "notion_oauth_record_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "notion_oauth_records_users" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "notion_oauth_record" DROP COLUMN "user_id";