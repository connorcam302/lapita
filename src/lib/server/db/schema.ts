import { boolean, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTable, serial, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 })
});

export const tracks = pgTable('tracks', {
	id: text('id').primaryKey(),
	name: varchar('name', { length: 255 })
});

export const granPrix = pgTable('gran_prix', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	live: boolean('live').default(true),
	order: integer('order').notNull()
});

export const races = pgTable('races', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	order: integer('order').notNull(),
	granPrixId: integer('gran_prix_id').references(() => granPrix.id),
	trackStartId: text('track_start_id').references(() => tracks.id),
	trackEndId: text('track_end_id').references(() => tracks.id)
});

export const results = pgTable('results', {
	id: serial('id').primaryKey(),
	userId: integer('user_id').references(() => users.id),
	raceId: integer('race_id').references(() => races.id)
});
