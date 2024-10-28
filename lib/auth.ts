import { betterAuth, type User } from "better-auth";
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
            }
        }
    },
    emailAndPassword: {
        enabled: true,
        async sendResetPassword(url, user) {
            console.log("Reset password url:", url);
        },
    },
})