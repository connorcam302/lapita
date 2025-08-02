import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getPlayerName, placementToPoints, calculateRaceWinChance } from '$lib/utils';

export const get = query({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		const races = await ctx.db
			.query('races')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect();

		if (races.length === 0) {
			return null;
		}

		// Use Promise.all to resolve all async operations
		return await Promise.all(
			races.map(async (race) => {
				const results = await ctx.db
					.query('results')
					.withIndex('raceId', (q) => q.eq('raceId', race._id))
					.collect();
				return {
					...race,
					results: results.sort((a, b) => b.userId.localeCompare(a.userId))
				};
			})
		);
	}
});

export const getPlayer = query({
	args: { userId: v.id('users') },
	handler: async (ctx, { userId }) => {
		const results = await ctx.db
			.query('results')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.collect()
			.then((results) => {
				return results.filter(
					(result) => result.position !== null && result.position !== undefined
				);
			});

		return await Promise.all(
			results.map(async (result) => {
				const race = await ctx.db
					.query('races')
					.withIndex('by_id', (q) => q.eq('_id', result.raceId))
					.unique();

				const grandPrix = await ctx.db
					.query('grandPrix')
					.withIndex('by_id', (q) => q.eq('_id', race.grandPrixId))
					.unique();

				return {
					...result,
					grandPrixOrder: grandPrix.order,
					grandPrixId: race?.grandPrixId,
					trackStartId: race?.trackStartId,
					trackEndId: race?.trackEndId
				};
			})
		).then((results) => {
			return results.sort((a, b) => {
				if (a.grandPrixOrder === b.grandPrixOrder) {
					return a.position - b.position;
				}
				return b.grandPrixOrder - a.grandPrixOrder;
			});
		});
	}
});

export const update = mutation({
	args: {
		grandPrixId: v.id('grandPrix'),
		raceId: v.id('races'),
		userId: v.id('users'),
		position: v.number(),
		kartId: v.id('karts'),
		characterId: v.id('characters')
	},
	handler: async (ctx, { raceId, userId, position, kartId, characterId, grandPrixId }) => {
		const currentResult = await ctx.db
			.query('results')
			.withIndex('raceIdAndUserId', (q) => q.eq('raceId', raceId).eq('userId', userId))
			.unique();

		const currentStandings = await ctx.db
			.query('grandPrixStandings')
			.withIndex('userIdAndGrandPrixId', (q) =>
				q.eq('userId', userId).eq('grandPrixId', grandPrixId)
			)
			.first();

		if (!currentStandings || !currentResult) {
			return;
		}

		let newPoints = currentStandings?.points + placementToPoints[position];

		if (currentResult?.position) {
			newPoints = newPoints - placementToPoints[currentResult.position];
		}

		await ctx.db.patch(currentStandings._id, {
			points: newPoints
		});

		await ctx.db.patch(currentResult?._id, {
			position,
			kartId,
			characterId
		});

		return { status: 'Ok' };
	}
});

export const stats = query({
	args: { tracks: v.array(v.id('tracks')), users: v.array(v.id('users')) },
	handler: async (ctx, { tracks, users }) => {
		const resultsByTrack = await Promise.all(
			tracks.map(async (track) => {
				const races = await ctx.db
					.query('races')
					.withIndex('trackId', (q) => q.eq('trackStartId', track).eq('trackEndId', track))
					.collect();
				// Await all results queries for each race
				const racesWithResults = await Promise.all(
					races.map(async (race) => {
						const results = await ctx.db
							.query('results')
							.withIndex('raceId', (q) => q.eq('raceId', race._id))
							.collect();
						const grandPrix = await ctx.db
							.query('grandPrix')
							.withIndex('by_id', (q) => q.eq('_id', race.grandPrixId))
							.unique();
						return results
							.filter((result) => users.includes(result.userId) && result.position)
							.map((result) => {
								return {
									userId: result.userId,
									kartId: result.kartId ?? undefined,
									characterId: result.characterId ?? undefined,
									position: result.position,
									order: grandPrix?.order
								};
							})
							.sort((a, b) => a.order - b.order);
					})
				);
				return { track, results: racesWithResults.flat() };
			})
		);

		const averages = resultsByTrack.map((track) => {
			// Accumulate sum and count for each user
			const trackAveragesByUserId = track.results.reduce(
				(acc, result) => {
					if (!acc[result.userId]) {
						acc[result.userId] = { userId: result.userId, sum: 0, count: 0, results: [] };
					}
					acc[result.userId].sum += result.position;
					acc[result.userId].count += 1;
					acc[result.userId].results.push(result.position);
					return acc;
				},
				{} as Record<string, { userId: string; sum: number; count: number; results: number[] }>
			);

			// Convert to array of averages
			const trackStats = Object.values(trackAveragesByUserId).map(({ userId, sum, count }) => ({
				userId,
				avg: sum / count,
				count,
				lastFiveResults: track.results
					.filter((result) => result.userId === userId)
					.slice(-5)
					.map((result) => result.position),
				bestResult: track.results
					.filter((result) => result.userId === userId)
					.sort((a, b) => a.position - b.position)[0].position
			}));
			return {
				trackId: track.track,
				stats: trackStats,
				chances: calculateRaceWinChance(
					trackStats.map((stat) => {
						return { ...stat, trackId: track.track };
					})
				)[0]
			};
		});
		return averages;
	}
});
