import { z } from "zod";

export const envSchema = z.object({
  // Database
  // Either DATABASE_URL or the separate DB_* variables must be provided
  DATABASE_URL: z.string().url().optional(),
  // Separate database connection variables (alternative to DATABASE_URL)
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.string().optional(),
  DB_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  DB_NAME: z.string().min(1).optional(),
  // Legacy PostgreSQL variables (for docker-compose compatibility)
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).optional(),

  // Notion OAuth
  NOTION_OAUTH_CLIENT_ID: z.string().min(1),
  NOTION_OAUTH_CLIENT_SECRET: z.string().min(1),
  NOTION_OAUTH_REDIRECT_URI: z.string().url().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),

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

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1), // E.164 format
  TWILIO_WEBHOOK_SECRET: z.string().min(1), // For signature validation
  CALL_PROFIT_MARGIN: z.string().transform(Number).default("0.50"), // 50% default

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1), // For frontend (public)
  STRIPE_WEBHOOK_SECRET: z.string().min(1), // For webhook signature validation

  // NOWPayments
  NOWPAYMENTS_API_KEY: z.string().min(1),
  NOWPAYMENTS_IPN_SECRET: z.string().min(1), // For IPN webhook signature validation
  NOWPAYMENTS_BASE_URL: z.string().url().optional(), // Base URL for callbacks (success_url, cancel_url, ipn_callback_url)
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
