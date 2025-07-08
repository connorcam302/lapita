import { boolean, json, text, timestamp, varchar } from 'drizzle-orm/pg-core';
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

export const grandPrix = pgTable('grand_prix', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	order: integer('order').notNull(),
	participants: json('participants').notNull()
});

export const races = pgTable('races', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	order: integer('order').notNull(),
	grandPrixId: integer('grand_prix_id').references(() => grandPrix.id),
	trackStartId: text('track_start_id').references(() => tracks.id),
	trackEndId: text('track_end_id').references(() => tracks.id),
	transition: boolean('transition').notNull().default(false)
});

export const results = pgTable('results', {
	id: serial('id').primaryKey(),
	position: integer('position'),
	userId: integer('user_id').references(() => users.id),
	raceId: integer('race_id').references(() => races.id),
	characterId: text('character_id').references(() => characters.id)
});

export const characters = pgTable('characters', {
	id: text('id').primaryKey(),
	name: varchar('name', { length: 255 })
});
