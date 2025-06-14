import { z } from "zod";

export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Notion OAuth
  NOTION_OAUTH_CLIENT_ID: z.string().min(1),
  NOTION_OAUTH_CLIENT_SECRET: z.string().min(1),
  NOTION_OAUTH_REDIRECT_URI: z.string().url().optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

// Create a type from the schema
export type Env = z.infer<typeof envSchema>;

// Create a runtime check function
export const validateEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  // if (!parsed.success) {
  //   console.log(JSON.stringify(process.env));
  //   console.error("❌ Invalid environment variables:", parsed.error);
  //   throw new Error("hi: " + JSON.stringify(process.env));
  //   throw new Error(
  //     "❌ Invalid environment variables:" +
  //       JSON.stringify(parsed.error, null, 2)
  //   );
  // }

  return parsed.data;
};
