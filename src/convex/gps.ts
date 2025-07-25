import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';

export const getOne = query({
	args: { id: v.id('grandPrix') },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('grandPrix')
			.withIndex('by_id', (q) => q.eq('_id', args.id))
			.unique();
	}
});

export const getAll = query({
	args: {
		pageSize: v.optional(v.number()),
		pageCount: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const pageSize = args.pageSize || 10;
		const pageCount = args.pageCount || 1;
		const count = pageSize * pageCount;
		const gps = await ctx.db.query('grandPrix').withIndex('order').order('desc').take(count);
		const page = await Promise.all(
			gps.map(async (gp) => {
				const gpStandings = await ctx.db
					.query('grandPrixStandings')
					.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
					.collect();

				const sortedStandings = gpStandings
					.sort((a, b) => b.points - a.points)
					.map((standing, index, sortedArray) => {
						// Find position by looking for the first occurrence of this point value
						const position = sortedArray.findIndex((s) => s.points === standing.points) + 1;
						return {
							userId: standing.userId,
							points: standing.points,
							position
						};
					});

				return {
					grandPrixId: gp._id,
					order: gp.order,
					standings: sortedStandings
				};
			})
		);
		return {
			...gps,
			page
		};
	}
});

export const newGp = mutation({
	args: { participants: v.array(v.id('users')) },
	handler: async (ctx, { participants }) => {
		const [gpMinus1, gpMinus2] = await ctx.db
			.query('grandPrix')
			.withIndex('order')
			.order('desc')
			.take(2);
		const oldGpTracks = await ctx.db
			.query('races')
			.filter((q) =>
				q.or(q.eq(q.field('grandPrixId'), gpMinus2._id), q.eq(q.field('grandPrixId'), gpMinus1._id))
			)
			.collect();

		const validTracks = await ctx.runQuery(api.tracks.valid, {});

		const trackWeights = validTracks.map((track) => {
			const oldGpTrackCount = oldGpTracks.filter((race) => race.trackStartId === track._id).length;

			let weight = 1;
			if (oldGpTrackCount === 2) {
				weight = 0.6;
			} else if (oldGpTrackCount === 1) {
				weight = 0.8;
			}
			return {
				...track,
				weight
			};
		});

		const generateTrackList = (tracks: typeof trackWeights, count: number) => {
			const availableItems = [...tracks]; // Copy the array
			const selected = [];

			for (let i = 0; i < count && availableItems.length > 0; i++) {
				// Calculate total weight of remaining items
				const totalWeight = availableItems.reduce((sum, item) => sum + item.weight, 0);

				// Generate random number
				const random = Math.random() * totalWeight;

				// Find selected item
				let currentWeight = 0;
				let selectedIndex = 0;

				for (let j = 0; j < availableItems.length; j++) {
					currentWeight += availableItems[j].weight;
					if (random <= currentWeight) {
						selectedIndex = j;
						break;
					}
				}

				// Add to selected and remove from available
				selected.push(availableItems[selectedIndex]);
				availableItems.splice(selectedIndex, 1);
			}

			return selected;
		};

		// select 16 random tracks from valid tracks
		const trackList = generateTrackList(trackWeights, 16);

		const newGpId = await ctx.db.insert('grandPrix', {
			order: gpMinus1.order + 1,
			participants
		});

		const raceList = trackList.map(async (track, i) => {
			return await ctx.db.insert('races', {
				grandPrixId: newGpId,
				trackStartId: track._id,
				trackEndId: track._id,
				order: i,
				transition: false
			});
		});

		participants.forEach((participantId) => {
			ctx.db.insert('grandPrixStandings', {
				grandPrixId: newGpId,
				points: 0,
				userId: participantId
			});
			raceList.forEach(async (track) => {
				ctx.db.insert('results', {
					raceId: await track,
					userId: participantId
				});
			});
		});
		return newGpId;
	}
});
