import { activeGpRows } from './gp_visibility';
import { ConvexError, v } from 'convex/values';
import { isValidFinishPosition } from '../lib/grand-prix';
import { mutation, query } from './_generated/server';
import { getPlayerName, placementToPoints, calculateRaceWinChance } from '$lib/utils';

export const get = query({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		const races = await activeGpRows(
			ctx,
			await ctx.db
				.query('races')
				.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
				.collect()
		);

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

				if (!grandPrix || grandPrix.deletedAt !== undefined) return null;
				return {
					...result,
					grandPrixOrder: grandPrix.order,
					grandPrixId: race?.grandPrixId,
					trackStartId: race?.trackStartId,
					trackEndId: race?.trackEndId
				};
			})
		).then((results) => {
			return results
				.filter((result) => result !== null)
				.sort((a, b) => {
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
		if (!isValidFinishPosition(position)) {
			throw new ConvexError('Finish position must be a whole number from 1 to 24.');
		}

		const [grandPrix, race, kart, character] = await Promise.all([
			ctx.db.get(grandPrixId),
			ctx.db.get(raceId),
			ctx.db.get(kartId),
			ctx.db.get(characterId)
		]);
		if (
			!grandPrix ||
			grandPrix.deletedAt !== undefined ||
			!race ||
			race.grandPrixId !== grandPrixId
		) {
			throw new ConvexError('The selected race does not belong to this Grand Prix.');
		}
		if (!grandPrix.participants.includes(userId)) {
			throw new ConvexError('The selected racer is not a participant in this Grand Prix.');
		}
		if (!kart || !character) {
			throw new ConvexError('Select an available character and kart.');
		}

		const currentResult = await ctx.db
			.query('results')
			.withIndex('raceIdAndUserId', (q) => q.eq('raceId', raceId).eq('userId', userId))
			.unique();

		const currentStandings = await ctx.db
			.query('grandPrixStandings')
			.withIndex('userIdAndGrandPrixId', (q) =>
				q.eq('userId', userId).eq('grandPrixId', grandPrixId)
			)
			.unique();

		if (!currentStandings || !currentResult) {
			throw new ConvexError('The result or GP standing is missing. Refresh and try again.');
		}

		// Rebuild from source results instead of applying a delta to a possibly corrupt total.
		// Convex commits both patches atomically and retries concurrent edits on conflicts.
		const races = await ctx.db
			.query('races')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect();
		const playerResults = await Promise.all(
			races.map((race) =>
				ctx.db
					.query('results')
					.withIndex('raceIdAndUserId', (q) => q.eq('raceId', race._id).eq('userId', userId))
					.unique()
			)
		);
		const points = playerResults.reduce((total, result) => {
			if (!result) return total;
			const finish = result._id === currentResult._id ? position : result.position;
			return total + (isValidFinishPosition(finish) ? placementToPoints[finish] : 0);
		}, 0);

		await ctx.db.patch(currentStandings._id, { points });

		await ctx.db.patch(currentResult._id, {
			position,
			kartId,
			characterId
		});

		return { status: 'Ok' };
	}
});

export const stats = query({
	args: {
		tracks: v.array(v.id('tracks')),
		users: v.array(v.id('users')),
		beforeGrandPrixId: v.optional(v.id('grandPrix'))
	},
	handler: async (ctx, { tracks, users, beforeGrandPrixId }) => {
		const cutoff = beforeGrandPrixId ? await ctx.db.get(beforeGrandPrixId) : null;
		if (beforeGrandPrixId && !cutoff) throw new ConvexError('Grand Prix not found.');
		const resultsByTrack = await Promise.all(
			tracks.map(async (track) => {
				const races = await activeGpRows(
					ctx,
					await ctx.db
						.query('races')
						.withIndex('trackId', (q) => q.eq('trackStartId', track).eq('trackEndId', track))
						.collect()
				);
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
						if (cutoff && (!grandPrix || grandPrix.order >= cutoff.order)) return [];
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
