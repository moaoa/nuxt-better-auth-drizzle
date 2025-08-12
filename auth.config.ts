import type { AuthConfig } from '@auth/core';
import { NuxtAuthHandler } from '#auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';

export default NuxtAuthHandler({
  secret: process.env.AUTH_SECRET,
  adapter: DrizzleAdapter(db),
  callbacks: {
    session: ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom sign in page
  },
} as AuthConfig);
