import { config } from "./env";

export const notionConfig = {
  clientId: config.notion.clientId,
  clientSecret: config.notion.clientSecret,
  redirectUri:
    config.notion.redirectUri ??
    "https://api.notion.com/v1/oauth/authorize?client_id=211d872b-594c-8090-a29f-003783d4e3b9&response_type=code&owner=user&redirect_uri=http://localhost:3000/auth/notion/callback",
  scopes: ["read_user", "write_user", "read_blocks", "write_blocks"],
  authUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
} as const;
