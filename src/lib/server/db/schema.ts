import { boolean, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { pgTable, serial, integer, } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 })
});

export const tracks = pgTable('tracks', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 })
});


export const granPrix = pgTable('gran_prix', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 }),
	live: boolean('live').default(true),
})

export const races = pgTable('races', {
	startTime: timestamp('finish_time').default(sql`now()`),
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 255 }),
	granPrixId: integer('gran_prix_id').references(() => granPrix.id),
	trackId: integer('track_id').references(() => tracks.id),
	live: boolean('live').default(true),
});

export const results = pgTable('results', {
	id: serial('id').primaryKey(),
	userId: integer('user_id').references(() => users.id),
	raceId: integer('race_id').references(() => races.id),
});
