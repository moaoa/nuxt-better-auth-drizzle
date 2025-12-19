import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// import * as schema from "~~/db/schema";
import * as schema from "../db/schema";
// import { useDrizzle } from "~~/server/utils/drizzle";
import { useDrizzle } from "../server/utils/drizzle";

import { sendUserVerificationEmail } from "../server/utils/email";

console.log("Better Auth Config:", {
  baseURL: process.env.BETTER_AUTH_URL,
  hasClientId: !!process.env.NUXT_GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.NUXT_GOOGLE_CLIENT_SECRET,
});

if (
  !process.env.NUXT_GOOGLE_CLIENT_ID ||
  !process.env.NUXT_GOOGLE_CLIENT_SECRET
) {
  console.warn(
    "WARNING: Google OAuth credentials are missing. Google login will not work."
  );
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  database: drizzleAdapter(useDrizzle(), {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        fieldName: "firstName",
        returned: true,
        input: true,
        required: true,
      },
      lastName: {
        type: "string",
        fieldName: "lastName",
        returned: true,
        input: true,
        required: true,
      },
    },
    deleteUser: {
      enabled: true,
    },
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await sendUserVerificationEmail(user, url);
    },
    sendOnSignUp: true,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword(url) {
      console.log("Reset password url:", url);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.NUXT_GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: (profile: any) => {
        // Handle cases where Google profile might not have given_name/family_name
        // Some users might only have a name field
        const firstName =
          profile.given_name || profile.name?.split(" ")[0] || "User";
        const lastName =
          profile.family_name ||
          profile.name?.split(" ").slice(1).join(" ") ||
          "";

        console.log("Google profile mapping:", {
          profile,
          firstName,
          lastName,
        });

        return {
          firstName,
          lastName: lastName || "User", // Ensure lastName is not empty since it's required
        };
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      defaultBanExpiresIn: 7 * 24 * 60 * 60,
      defaultBanReason: "Spamming",
      impersonationSessionDuration: 1 * 24 * 60 * 60,
    }),
  ],
});
