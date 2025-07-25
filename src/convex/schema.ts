import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		name: v.optional(v.string()),
		id: v.optional(v.number())
	})
		.index('name', ['name'])
		.index('id', ['id']),
	tracks: defineTable({
		name: v.optional(v.string()),
		id: v.optional(v.string()),
		img: v.optional(v.string())
	})
		.index('name', ['name'])
		.index('id', ['id']),
	characters: defineTable({
		name: v.optional(v.string()),
		id: v.optional(v.string()),
		img: v.optional(v.string())
	})
		.index('name', ['name'])
		.index('id', ['id']),
	karts: defineTable({
		name: v.optional(v.string()),
		id: v.optional(v.string()),
		img: v.optional(v.string())
	})
		.index('name', ['name'])
		.index('id', ['id']),
	grandPrix: defineTable({
		order: v.optional(v.number()),
		id: v.optional(v.number()),
		participants: v.optional(v.array(v.union(v.id('users'), v.number()))),
		finish_time: v.optional(v.string())
	})
		.index('order', ['order'])
		.index('id', ['id']),
	grandPrixStandings: defineTable({
		grandPrixId: v.optional(v.id('grandPrix')),
		userId: v.optional(v.id('users')),
		points: v.optional(v.number())
	})
		.index('grandPrixId', ['grandPrixId'])
		.index('points', ['points'])
		.index('userId', ['userId'])
		.index('userIdAndGrandPrixId', ['userId', 'grandPrixId']),
	races: defineTable({
		order: v.optional(v.number()),
		id: v.optional(v.number()),
		finish_time: v.optional(v.string()),
		grandPrixId: v.optional(v.id('grandPrix')),
		grand_prix_id: v.optional(v.number()),
		trackStartId: v.optional(v.id('tracks')),
		track_start_id: v.optional(v.string()),
		trackEndId: v.optional(v.id('tracks')), // Now pure v.id.
		track_end_id: v.optional(v.string()), // Now pure v.id
		transition: v.optional(v.boolean())
	})
		.index('grandPrixId', ['grandPrixId'])
		.index('trackId', ['trackStartId', 'trackEndId'])
		.index('id', ['id']),
	results: defineTable({
		id: v.optional(v.number()),
		position: v.optional(v.union(v.null(), v.number())),
		userId: v.optional(v.id('users')),
		user_id: v.optional(v.number()),
		raceId: v.optional(v.id('races')),
		race_id: v.optional(v.number()),
		characterId: v.optional(v.id('characters')), // Now pure v.id
		character_id: v.optional(v.union(v.string(), v.null())),
		kartId: v.optional(v.id('karts')), // Now pure v.id
		kart_id: v.optional(v.union(v.string(), v.null()))
	})
		.index('raceId', ['raceId'])
		.index('raceIdAndUserId', ['raceId', 'userId'])
		.index('id', ['id'])
});
