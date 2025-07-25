import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		name: v.string()
	}).index('name', ['name']),

	tracks: defineTable({
		name: v.string(),
		img: v.string()
	}).index('name', ['name']),

	characters: defineTable({
		name: v.optional(v.string()),
		img: v.optional(v.string())
	}).index('name', ['name']),

	karts: defineTable({
		name: v.string(),
		img: v.string()
	}).index('name', ['name']),

	grandPrix: defineTable({
		order: v.number(),
		participants: v.array(v.id('users'))
	}).index('order', ['order']),

	grandPrixStandings: defineTable({
		grandPrixId: v.id('grandPrix'),
		userId: v.id('users'),
		points: v.number()
	})
		.index('grandPrixId', ['grandPrixId'])
		.index('points', ['points'])
		.index('userId', ['userId'])
		.index('userIdAndGrandPrixId', ['userId', 'grandPrixId']),

	races: defineTable({
		order: v.number(),
		grandPrixId: v.id('grandPrix'),
		trackStartId: v.id('tracks'),
		trackEndId: v.id('tracks'), // Now pure v.id.
		transition: v.boolean()
	})
		.index('grandPrixId', ['grandPrixId'])
		.index('trackId', ['trackStartId', 'trackEndId']),

	results: defineTable({
		position: v.optional(v.union(v.null(), v.number())),
		userId: v.id('users'),
		raceId: v.id('races'),
		characterId: v.optional(v.id('characters')),
		kartId: v.optional(v.id('karts'))
	})
		.index('raceId', ['raceId'])
		.index('raceIdAndUserId', ['raceId', 'userId'])
});
