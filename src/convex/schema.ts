import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		name: v.string()
	}).index('name', ['name']),

	tracks: defineTable({
		name: v.string()
	}).index('name', ['name']),

	characters: defineTable({
		name: v.string()
	}).index('name', ['name']),

	karts: defineTable({
		name: v.string()
	}).index('name', ['name']),

	grandPrix: defineTable({
		order: v.number(),
		participants: v.array(v.id('users'))
	}).index('order', ['order']),

	races: defineTable({
		order: v.number(),
		grandPrixId: v.id('grandPrix'),
		trackStartId: v.id('tracks'), // Now pure v.id
		trackEndId: v.id('tracks'), // Now pure v.id
		transition: v.boolean()
	}).index('grandPrixId', ['grandPrixId']),

	results: defineTable({
		position: v.optional(v.number()),
		userId: v.id('users'),
		raceId: v.id('races'),
		characterId: v.optional(v.id('characters')), // Now pure v.id
		kartId: v.optional(v.id('karts')) // Now pure v.id
	})
});
