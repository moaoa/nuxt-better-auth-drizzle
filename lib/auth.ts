import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "../db/schema";
import { useDrizzle } from "../server/utils/drizzle";


export const auth = betterAuth({
    database: drizzleAdapter(useDrizzle(), {
        provider: "sqlite",
        schema: {
            ...schema
        }
    }),
    emailAndPassword: {
        enabled: true,
        async sendResetPassword(url, user) {
            console.log("Reset password url:", url);
        },
    },
})