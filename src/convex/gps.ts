import { activeGpRows } from './gp_visibility';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';
import {
	hasAllResults,
	summarizeGrandPrix,
	rankGrandPrixStandings,
	isValidFinishPosition
} from '../lib/grand-prix';
import { buildArchive } from '../lib/gp-archive';

export const getOne = query({
	args: { id: v.id('grandPrix') },
	handler: async (ctx, args) => {
		const gp = await ctx.db.get(args.id);
		return gp && gp.deletedAt === undefined ? gp : null;
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
		const fetched = await ctx.db
			.query('grandPrix')
			.withIndex('order')
			.order('desc')
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.take(count + 1);
		const gps = fetched.slice(0, count);
		const page = await Promise.all(
			gps.map(async (gp) => {
				const gpStandings = await ctx.db
					.query('grandPrixStandings')
					.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
					.collect();

				const races = await ctx.db
					.query('races')
					.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
					.collect();
				const raceResults = await Promise.all(
					races
						.sort((a, b) => a.order - b.order)
						.map(async (race) => ({
							race,
							results: await ctx.db
								.query('results')
								.withIndex('raceId', (q) => q.eq('raceId', race._id))
								.collect()
						}))
				);
				const completed = raceResults.filter(({ results }) =>
					hasAllResults(gp.participants, results)
				);
				const nextRace =
					gp.completedAt === undefined
						? raceResults.find((entry) => !completed.includes(entry))?.race
						: undefined;
				const coverTrackId = (nextRace ?? races[0])?.trackEndId;

				const summary = summarizeGrandPrix(
					gp.participants,
					raceResults,
					gp.completedAt,
					gp.knockoutWinnerId
				);
				const sortedStandings = rankGrandPrixStandings(gpStandings, summary.knockoutWinnerId);

				return {
					grandPrixId: gp._id,
					createdAt: gp._creationTime,
					order: gp.order,
					era: gp.era,
					knockoutWinnerId: summary.knockoutWinnerId,
					standings: sortedStandings.map(({ userId, points, position }) => ({
						userId,
						points,
						position
					})),
					raceCount: races.length,
					completedRaces: completed.length,
					completedAt: gp.completedAt,
					nextRaceId: nextRace?._id ?? null,
					coverTrackId: coverTrackId ?? null
				};
			})
		);
		return {
			hasMore: fetched.length > count,
			page
		};
	}
});

export const getPlayerResults = query({
	args: { userId: v.id('users') },
	handler: async (ctx, { userId }) => {
		const playerGps = await activeGpRows(
			ctx,
			await ctx.db
				.query('grandPrixStandings')
				.withIndex('userId', (q) => q.eq('userId', userId))
				.collect()
		);

		return Promise.all(
			playerGps.map(async (gp) => {
				const gpStandings = await ctx.db
					.query('grandPrixStandings')
					.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp.grandPrixId))
					.collect();

				const gpDetails = await ctx.db
					.query('grandPrix')
					.withIndex('by_id', (q) => q.eq('_id', gp.grandPrixId))
					.unique();

				const races = await ctx.db
					.query('races')
					.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp.grandPrixId))
					.collect();
				const raceResults = await Promise.all(
					races.map(async (race) => ({
						results: await ctx.db
							.query('results')
							.withIndex('raceId', (q) => q.eq('raceId', race._id))
							.collect()
					}))
				);
				const summary = summarizeGrandPrix(
					gpDetails!.participants,
					raceResults,
					gpDetails!.completedAt,
					gpDetails!.knockoutWinnerId
				);

				const sortedStandings = rankGrandPrixStandings(gpStandings, summary.knockoutWinnerId);

				return {
					grandPrixId: gp.grandPrixId,
					order: gpDetails!.order,
					won: summary.winnerIds.includes(userId),
					wonViaKnockout: summary.knockoutWinnerId === userId,
					position: sortedStandings.find((standing) => standing.userId === userId)?.position,
					points: sortedStandings.find((standing) => standing.userId === userId)?.points
				};
			})
		);
	}
});

export const newGp = mutation({
	args: { participants: v.array(v.id('users')) },
	handler: async (ctx, { participants }) => {
		const latest = await ctx.db.query('grandPrix').withIndex('order').order('desc').first();
		const [gpMinus1, gpMinus2] = await ctx.db
			.query('grandPrix')
			.withIndex('order')
			.order('desc')
			.filter((q) => q.eq(q.field('deletedAt'), undefined))
			.take(2);
		const oldGpTracks = (
			await Promise.all(
				[gpMinus1, gpMinus2].filter(Boolean).map((gp) =>
					ctx.db
						.query('races')
						.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
						.collect()
				)
			)
		).flat();

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
			order: (latest?.order ?? 0) + 1,
			participants
		});

		const raceList = await Promise.all(
			trackList.map((track, i) =>
				ctx.db.insert('races', {
					grandPrixId: newGpId,
					trackStartId: track._id,
					trackEndId: track._id,
					order: i,
					transition: false
				})
			)
		);

		for (const participantId of participants) {
			await ctx.db.insert('grandPrixStandings', {
				grandPrixId: newGpId,
				points: 0,
				userId: participantId
			});
			for (const raceId of raceList) {
				await ctx.db.insert('results', { raceId, userId: participantId });
			}
		}
		return newGpId;
	}
});

// Load the complete archive so filtering always includes older Grand Prix.
export const archive = query({
	args: {},
	handler: async (ctx) => {
		const [gps, races, results, standings] = await Promise.all([
			ctx.db.query('grandPrix').collect(),
			ctx.db.query('races').collect(),
			ctx.db.query('results').collect(),
			ctx.db.query('grandPrixStandings').collect()
		]);
		return buildArchive(
			gps.filter((gp) => gp.deletedAt === undefined),
			races,
			results,
			standings
		);
	}
});

/** Adding a racer includes every race, allowing earlier results to be backfilled. */
export const addRacers = mutation({
	args: { grandPrixId: v.id('grandPrix'), userIds: v.array(v.id('users')) },
	handler: async (ctx, { grandPrixId, userIds }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp || gp.deletedAt !== undefined) throw new ConvexError('This Grand Prix is unavailable.');
		if (!userIds.length) throw new ConvexError('Select at least one racer.');
		const users = await Promise.all([...new Set(userIds)].map((id) => ctx.db.get(id)));
		if (users.some((user) => !user)) throw new ConvexError('A selected racer no longer exists.');
		const additions = [...new Set(userIds)].filter((id) => !gp.participants.includes(id));
		const races = await ctx.db
			.query('races')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect();
		for (const userId of additions) {
			await ctx.db.insert('grandPrixStandings', { grandPrixId, userId, points: 0 });
			for (const race of races) {
				await ctx.db.insert('results', { raceId: race._id, userId });
			}
		}
		await ctx.db.patch(grandPrixId, {
			participants: [...gp.participants, ...additions],
			...(additions.length ? { knockoutWinnerId: undefined, knockoutResults: undefined } : {})
		});
	}
});

/** Retain all related documents so restoring also preserves existing links and IDs. */
export const remove = mutation({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp || gp.deletedAt !== undefined) return;
		await ctx.db.patch(grandPrixId, { deletedAt: Date.now() });
	}
});

export const deleted = query({
	args: {},
	handler: async (ctx) => {
		const gps = await ctx.db
			.query('grandPrix')
			.filter((q) => q.neq(q.field('deletedAt'), undefined))
			.collect();
		return gps.sort((a, b) => b.deletedAt! - a.deletedAt!);
	}
});

export const restore = mutation({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp) throw new ConvexError('This Grand Prix no longer exists.');
		if (gp.deletedAt === undefined) return;
		await ctx.db.patch(grandPrixId, { deletedAt: undefined });
	}
});

/** Explicit, reversible completion without inventing race results. */
export const setComplete = mutation({
	args: { grandPrixId: v.id('grandPrix'), complete: v.boolean() },
	handler: async (ctx, { grandPrixId, complete }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp || gp.deletedAt !== undefined) throw new ConvexError('This Grand Prix is unavailable.');
		if (complete) {
			const races = await ctx.db
				.query('races')
				.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
				.collect();
			if (!races.length || !gp.participants.length)
				throw new ConvexError('A Grand Prix needs races and racers before it can be completed.');
		}
		await ctx.db.patch(grandPrixId, {
			completedAt: complete ? (gp.completedAt ?? Date.now()) : undefined,
			...(!complete ? { knockoutWinnerId: undefined, knockoutResults: undefined } : {})
		});
	}
});

/** The extra Knockout Tour race is open only to the two tied GP leaders. */
export const recordKnockoutResult = mutation({
	args: {
		grandPrixId: v.id('grandPrix'),
		userId: v.id('users'),
		position: v.union(v.number(), v.null())
	},
	handler: async (ctx, { grandPrixId, userId, position }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp || gp.deletedAt !== undefined) throw new ConvexError('This Grand Prix is unavailable.');
		if (position !== null && !isValidFinishPosition(position)) {
			throw new ConvexError('Finish position must be a whole number from 1 to 24.');
		}
		const races = await ctx.db
			.query('races')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect();
		const raceResults = await Promise.all(
			races.map(async (race) => ({
				results: await ctx.db
					.query('results')
					.withIndex('raceId', (q) => q.eq('raceId', race._id))
					.collect()
			}))
		);
		const summary = summarizeGrandPrix(gp.participants, raceResults, gp.completedAt);
		if (!summary.complete)
			throw new ConvexError('Complete the Grand Prix before entering Knockout Tour results.');
		if (summary.tiedLeaderIds.length !== 2 || !summary.tiedLeaderIds.includes(userId)) {
			throw new ConvexError('Only the two racers tied for first can enter Knockout Tour results.');
		}
		const entries = (gp.knockoutResults ?? []).filter(
			(result) => summary.tiedLeaderIds.includes(result.userId) && result.userId !== userId
		);
		if (position !== null) {
			if (entries.some((result) => result.position === position)) {
				throw new ConvexError('The racers must have different finishing positions.');
			}
			entries.push({ userId, position });
		}
		const winner =
			entries.length === 2
				? [...entries].sort((a, b) => a.position - b.position)[0].userId
				: undefined;
		await ctx.db.patch(grandPrixId, {
			knockoutResults: entries.length ? entries : undefined,
			knockoutWinnerId: winner
		});
	}
});

/** Era tags belong to existing GPs; future GPs are never tagged implicitly. */
export const eraOptions = query({
	args: {},
	handler: async (ctx) => {
		const gps = await ctx.db.query('grandPrix').collect();
		return [
			...new Set(
				gps.filter((gp) => gp.deletedAt === undefined).flatMap((gp) => (gp.era ? [gp.era] : []))
			)
		].sort();
	}
});

export const setEra = mutation({
	args: { from: v.number(), to: v.number(), era: v.string() },
	handler: async (ctx, { from, to, era }) => {
		if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from)
			throw new ConvexError('Enter a valid GP range, starting at 1 or higher.');
		const name = era.trim();
		if (name.length > 80) throw new ConvexError('Era names must be 80 characters or fewer.');
		const gps = (
			await ctx.db
				.query('grandPrix')
				.withIndex('order', (q) => q.gte('order', from).lte('order', to))
				.collect()
		).filter((gp) => gp.deletedAt === undefined);
		if (!gps.length) throw new ConvexError('No available Grand Prix in this range.');
		for (const gp of gps) await ctx.db.patch(gp._id, { era: name || undefined });
		return gps.length;
	}
});

/** Latest by GP order, including manual completion, without limiting to a history page. */
export const latestCompleted = query({
	args: {},
	handler: async (ctx) => {
		const gps = ctx.db.query('grandPrix').withIndex('order').order('desc');
		for await (const gp of gps) {
			if (gp.deletedAt !== undefined || gp.participants.length === 0) continue;
			const races = await ctx.db
				.query('races')
				.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gp._id))
				.collect();
			if (!races.length) continue;
			if (gp.completedAt !== undefined) return { id: gp._id, order: gp.order };
			let complete = true;
			for (const race of races) {
				const results = await ctx.db
					.query('results')
					.withIndex('raceId', (q) => q.eq('raceId', race._id))
					.collect();
				if (!hasAllResults(gp.participants, results)) {
					complete = false;
					break;
				}
			}
			if (complete) return { id: gp._id, order: gp.order };
		}
		return null;
	}
});
