ALTER TABLE "notion_oauth" RENAME COLUMN "workspace_id" TO "notion_workspace_id";--> statement-breakpoint
ALTER TABLE "notion_oauth" DROP CONSTRAINT "notion_oauth_workspace_id_workspace_id_fk";
--> statement-breakpoint
ALTER TABLE "notion_oauth" ADD CONSTRAINT "notion_oauth_notion_workspace_id_workspace_id_fk" FOREIGN KEY ("notion_workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;