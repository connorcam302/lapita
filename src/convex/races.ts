import { summarizeTrackOverview } from '../lib/track-stats';
import { activeGpRows } from './gp_visibility';
import { ConvexError } from 'convex/values';
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
		return (await activeGpRows(ctx, res)).map((race) => ({
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
		const race = await ctx.db.get(args.raceId);
		const gp = race ? await ctx.db.get(race.grandPrixId) : null;
		if (!gp || gp.deletedAt !== undefined) throw new ConvexError('This Grand Prix is unavailable.');
		return ctx.db.patch(args.raceId, {
			trackStartId: args.trackStartId,
			trackEndId: args.trackEndId,
			transition: args.trackEndId !== args.trackStartId
		});
	}
});

export const getStats = query({
	args: {},
	handler: async (ctx, args) => {
		const races = await activeGpRows(
			ctx,
			await ctx.db.query('races').withIndex('by_creation_time').order('desc').collect()
		);

		const tracks = await ctx.db.query('tracks').collect();
		const users = await ctx.db.query('users').collect();

		// Load active race history; the shared summary validates individual finishes.
		const raceData = await Promise.all(
			races.map(async (race) => {
				const results = await ctx.db
					.query('results')
					.withIndex('raceId', (q) => q.eq('raceId', race._id))
					.collect();

				return {
					_id: race._id,
					trackStartId: race.trackStartId,
					trackEndId: race.trackEndId,
					order: race.order,
					grandPrixId: race.grandPrixId,
					transition: race.transition,
					results
				};
			})
		);

		return summarizeTrackOverview(tracks, users, raceData);
	}
});
