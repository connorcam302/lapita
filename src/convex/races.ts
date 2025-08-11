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

export const getStats = query({
	args: {},
	handler: async (ctx, args) => {
		const races = await ctx.db.query('races').withIndex('by_creation_time').order('desc').collect();

		const tracks = await ctx.db.query('tracks').collect();
		const users = await ctx.db.query('users').collect();

		// Preload race results and ensure positions are sorted properly
		const raceData = await Promise.all(
			races.map(async (race) => {
				const results = await ctx.db
					.query('results')
					.withIndex('raceId', (q) => q.eq('raceId', race._id))
					.collect();

				// Sort so 1 = first place, lowest number first
				const sortedResults = results
					.filter((r) => typeof r.position === 'number') // no nulls
					.sort((a, b) => a.position - b.position)
					.map((result) => ({
						userId: result.userId,
						position: result.position
					}));

				return {
					_id: race._id,
					trackStartId: race.trackStartId,
					trackEndId: race.trackEndId,
					order: race.order,
					grandPrixId: race.grandPrixId,
					transition: race.transition,
					results: sortedResults
				};
			})
		);

		// Calculate stats per track
		const stats = await Promise.all(
			tracks.map(async (track) => {
				// Include races where the track was either start or end
				const trackRaces = raceData.filter((race) => race.trackEndId === track._id);

				const userAverages = users
					.map((user) => {
						const userResults = trackRaces
							.map((race) => race.results.find((r) => r.userId === user._id))
							.filter((r) => r !== undefined && typeof r.position === 'number');

						if (userResults.length === 0) {
							return {
								userId: user._id,
								userName: user.name,
								average: null
							};
						}

						const sum = userResults.reduce((acc, r) => acc + r.position, 0);
						return {
							userId: user._id,
							userName: user.name,
							average: sum / userResults.length
						};
					})
					.filter((u) => u.average !== null)
					.sort((a, b) => a.average - b.average);

				const resultsCounts = trackRaces.map((race) => race.results.length);
				const averageParticipants = resultsCounts.reduce((a, b) => a + b, 0) / resultsCounts.length;

				return {
					trackId: track._id,
					trackName: track.name,
					trackImg: track.img,
					averageParticipants,
					userAverages,
					counts: trackRaces.length
				};
			})
		);

		return stats;
	}
});
