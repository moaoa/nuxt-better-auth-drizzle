import type { H3Event } from 'h3';
import { auth } from '~~/lib/auth';

export interface UserSession {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    image?: string | null;
    role?: string | null;
    banned?: boolean | null;
    banReason?: string | null;
    banExpires?: Date | null;
  };
}

export async function requireUserSession(event: H3Event): Promise<UserSession> {
  try {
    // Get the session using better-auth's API
    const session = await auth.api.getSession({
      headers: event.headers,
    });
    
    if (!session?.user?.id) {
      throw new Error('No user session found');
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        emailVerified: session.user.emailVerified,
        image: session.user.image,
        role: session.user.role,
        banned: session.user.banned,
        banReason: session.user.banReason,
        banExpires: session.user.banExpires,
      }
    };
  } catch (error) {
    console.error('Session error:', error);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    });
  }
}
