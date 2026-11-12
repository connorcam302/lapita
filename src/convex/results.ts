import { activeGpRows } from './gp_visibility';
import { ConvexError, v } from 'convex/values';
import { isValidFinishPosition } from '../lib/grand-prix';
import { buildTrackForecastStats, fillTrackForecastStats } from '../lib/race-forecast';
import { mutation, query } from './_generated/server';
import { placementToPoints, calculateRaceWinChance } from '$lib/utils';

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
						if (!grandPrix || (cutoff && grandPrix.order >= cutoff.order)) return [];
						return results
							.filter(
								(result) => users.includes(result.userId) && isValidFinishPosition(result.position)
							)
							.map((result) => {
								return {
									userId: result.userId,
									kartId: result.kartId ?? undefined,
									characterId: result.characterId ?? undefined,
									position: result.position,
									grandPrixOrder: grandPrix.order,
									raceOrder: race.order,
									createdAt: result._creationTime,
									id: result._id
								};
							});
					})
				);
				return { track, results: racesWithResults.flat() };
			})
		);

		const trackStatsByTrack = resultsByTrack.map((track) => ({
			trackId: track.track,
			stats: buildTrackForecastStats(track.results)
		}));
		const missingUsers = users.filter((userId) =>
			trackStatsByTrack.some((track) => !track.stats.some((stat) => stat.userId === userId))
		);
		// Read other tracks only for racers who need a fallback. Apply the same historical
		// cutoff as track stats so starting forecasts cannot see this GP or later results.
		const overallHistory = await Promise.all(
			missingUsers.map(async (userId) => {
				const results = await ctx.db
					.query('results')
					.withIndex('userId', (q) => q.eq('userId', userId))
					.collect();
				return Promise.all(
					results
						.filter((result) => isValidFinishPosition(result.position))
						.map(async (result) => {
							const race = await ctx.db.get(result.raceId);
							if (!race) return [];
							const gp = await ctx.db.get(race.grandPrixId);
							if (!gp || gp.deletedAt !== undefined || (cutoff && gp.order >= cutoff.order))
								return [];
							return [
								{
									userId,
									position: result.position,
									grandPrixOrder: gp.order,
									raceOrder: race.order,
									createdAt: result._creationTime,
									id: result._id
								}
							];
						})
				);
			})
		);
		const overallStats = buildTrackForecastStats(overallHistory.flat(2));
		const averages = trackStatsByTrack.map(({ trackId, stats: trackStats }) => ({
			trackId,
			stats: trackStats,
			chances: calculateRaceWinChance(
				fillTrackForecastStats(users, trackStats, overallStats).map((stat) => ({
					...stat,
					avg: stat.weightedAvg,
					trackId
				}))
			)[0]
		}));
		return averages;
	}
});

/** Bounded, on-demand profile progress; no extra full player-history subscription. */
export const personalProgress = query({
	args: {
		userId: v.id('users'),
		size: v.union(v.literal(1), v.literal(5), v.literal(10), v.literal(20)),
		through: v.optional(v.number())
	},
	handler: async (ctx, { userId, size, through }) => {
		if (through !== undefined && (!Number.isSafeInteger(through) || through < 1)) {
			throw new ConvexError('Choose a positive whole GP number.');
		}
		const candidates = ctx.db
			.query('grandPrix')
			.withIndex('order', (q) => (through === undefined ? q : q.lte('order', through)))
			.order('desc');
		const gps: import('../lib/personal-progress').ProgressGp[] = [];
		let scanned = 0;
		let limited = false;
		for await (const gp of candidates) {
			if (scanned === 500) {
				limited = true;
				break;
			}
			scanned++;
			if (gp.deletedAt !== undefined || !gp.participants.includes(userId)) continue;
			const races = await ctx.db
				.query('races')
				.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
				.collect();
			const finishes = (
				await Promise.all(
					races.map(async (race) => {
						const results = await ctx.db
							.query('results')
							.withIndex('raceIdAndUserId', (q) => q.eq('raceId', race._id).eq('userId', userId))
							.collect();
						return results.flatMap((result) =>
							isValidFinishPosition(result.position)
								? [{ trackEndId: race.trackEndId, position: result.position }]
								: []
						);
					})
				)
			).flat();
			if (finishes.length)
				gps.push({ id: gp._id, order: gp.order, createdAt: gp._creationTime, finishes });
			if (gps.length === size * 2) break;
		}
		return { gps, limited };
	}
});
