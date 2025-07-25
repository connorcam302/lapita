import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

export const inGrandPrix = query({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, args) => {
		const res = await ctx.db
			.query('races')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', args.grandPrixId))
			.collect();
		return res.map((race) => ({
			_id: race._id,
			trackStartId: race.trackStartId,
			trackEndId: race.trackEndId,
			order: race.order,
			grandPrixId: race.grandPrixId,
			transition: race.transition
		}));
	}
});

export const updateTrack = mutation({
	args: { raceId: v.id('races'), trackStartId: v.id('tracks'), trackEndId: v.id('tracks') },
	handler: async (ctx, args) => {
		return ctx.db.patch(args.raceId, {
			trackStartId: args.trackStartId,
			trackEndId: args.trackEndId,
			transition: args.trackEndId !== args.trackStartId
		});
	}
});
