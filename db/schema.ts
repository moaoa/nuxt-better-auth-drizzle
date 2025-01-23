
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";


export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	firstName: text('firstName'),
	lastName: text('lastName'),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', {
		mode: "boolean"
	}).notNull(),
	image: text('image'),
	role: text('role', { enum: ["user", "admin"] }).notNull().default("user"),
	banned: integer('banned', { mode: "boolean" }).notNull().default(false),
	banReason: text('ban_reason'),
	banExpires: integer('ban_expires', { mode: "timestamp" }),
	createdAt: integer('createdAt', {
		mode: "timestamp"
	}).notNull(),
	updatedAt: integer('updatedAt', {
		mode: "timestamp"
	}).notNull()
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer('expiresAt', {
		mode: "timestamp"
	}).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId').notNull().references(() => user.id),
	impersonatedBy: text('impersonated_by').references(() => user.id),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId').notNull().references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', {
		mode: "timestamp"
	}).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
});

/***
* Custom table here 
**/
export const tools = sqliteTable("tool", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	url: text("url"),
	description: text("description"),
	likes: integer("likes"),
	tags: text("tags"),
	pricing: text("pricing"),
	imageUrl: text("image_url"),
});