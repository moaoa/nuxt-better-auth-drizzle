ALTER TABLE "verification" RENAME COLUMN "expires" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "created_at" TO "createdAt";--> statement-breakpoint
ALTER TABLE "verification" RENAME COLUMN "updated_at" TO "updatedAt";--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "verification" ADD COLUMN "value" text NOT NULL;--> statement-breakpoint
ALTER TABLE "verification" DROP COLUMN "token";