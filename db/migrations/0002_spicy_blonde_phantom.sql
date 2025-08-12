ALTER TABLE "notion_oauth" RENAME COLUMN "notion_workspace_id" TO "workspace_id";--> statement-breakpoint
ALTER TABLE "notion_oauth" DROP CONSTRAINT "notion_oauth_notion_workspace_id_workspace_uuid_fk";
--> statement-breakpoint
ALTER TABLE "notion_oauth" ADD CONSTRAINT "notion_oauth_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;