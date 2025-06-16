import { validateEnv, type Env } from "./env.schema";

// Validate environment variables at startup
const env = validateEnv();
console.log("env: after validateEnv", env?.DATABASE_URL);

// Export a type-safe environment object
export const config = {
  database: {
    url: env?.DATABASE_URL,
  },
  notion: {
    clientId:
      env?.NOTION_OAUTH_CLIENT_ID ?? "211d872b-594c-8090-a29f-003783d4e3b9",
    clientSecret:
      env?.NOTION_OAUTH_CLIENT_SECRET ??
      "secret_x4pRlEBIZnqzlPk2EZogY2rWNXuck9OnKqlg8gMGzdJ",
    redirectUri:
      env?.NOTION_OAUTH_REDIRECT_URI ||
      "http://localhost:3000/auth/notion/callback",
  },
  auth: {
    secret: env?.BETTER_AUTH_SECRET,
    origin: env?.BETTER_AUTH_URL,
  },
  nodeEnv: env?.NODE_ENV,
} as const;

// Export the type of the config object
export type Config = typeof config;
