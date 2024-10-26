const isProd = process.env.NODE_ENV === 'production';

export const tursoConfig = {
    isProd,
    url: isProd ? process.env.TURSO_DATABASE_URL as string : 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN as string 
};