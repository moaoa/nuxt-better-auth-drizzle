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

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.string().transform(Number).default("6379"),
  REDIS_PASSWORD: z.string().optional(),
});

// Create a type from the schema
export type Env = z.infer<typeof envSchema>;

// Create a runtime check function
export const validateEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(
      "❌ Invalid environment variables:" +
        JSON.stringify(parsed.error, null, 2)
    );
  }

  return parsed.data;
};
