import { Migrations } from '@convex-dev/migrations';
import { components, internal } from './_generated/api.js';
import type { DataModel, Id } from './_generated/dataModel.js';
import type { QueryCtx } from './_generated/server.js';
import { placementToPoints } from '$lib/utils.js';

export const migrations = new Migrations<DataModel>(components.migrations);
export const run = migrations.runner();

// Helper functions to get documents by either old string ID or new Convex ID
async function getTrackById(ctx: QueryCtx, id: string | Id<'tracks'>) {
	const convexId = ctx.db.normalizeId('tracks', id);
	if (convexId !== null) {
		return ctx.db.get(convexId);
	} else {
		return ctx.db
			.query('tracks')
			.withIndex('id', (q) => q.eq('id', id))
			.unique();
	}
}

async function getGrandPrixById(ctx: QueryCtx, id: number) {
	return ctx.db
		.query('grandPrix')
		.withIndex('id', (q) => q.eq('id', id))
		.unique();
}

async function getCharacterById(ctx: QueryCtx, id: string) {
	return ctx.db
		.query('characters')
		.withIndex('id', (q) => q.eq('id', id))
		.unique();
}

async function getKartById(ctx: QueryCtx, id: string) {
	return ctx.db
		.query('karts')
		.withIndex('id', (q) => q.eq('id', id))
		.unique();
}

async function getUserById(ctx: QueryCtx, id: number) {
	return ctx.db
		.query('users')
		.withIndex('id', (q) => q.eq('id', id))
		.unique();
}

async function getRaceById(ctx: QueryCtx, id: number) {
	return ctx.db
		.query('races')
		.withIndex('id', (q) => q.eq('id', id))
		.unique();
}

async function getRacesByGpId(ctx: QueryCtx, gpId: Id<'grandPrix'>) {
	return ctx.db
		.query('races')
		.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gpId))
		.collect();
}

async function getResultsByRaceIdAndUserId(
	ctx: QueryCtx,
	raceId: Id<'races'>,
	userId: Id<'users'>
) {
	return ctx.db
		.query('results')
		.withIndex('raceIdAndUserId', (q) => q.eq('raceId', raceId).eq('userId', userId))
		.collect();
}

async function getResultsByRaceId(ctx: QueryCtx, raceId: Id<'races'>) {
	return ctx.db
		.query('results')
		.withIndex('raceId', (q) => q.eq('raceId', raceId))
		.collect();
}

async function getGrandPrixStandingsByGrandPrixId(ctx: QueryCtx, gpId: Id<'grandPrix'>) {
	return ctx.db
		.query('grandPrixStandings')
		.withIndex('grandPrixId', (q) => q.eq('grandPrixId', gpId))
		.collect();
}

// Step 3: Migration to update trackStartId and trackEndId in races

export const updateCharacters = migrations.define({
	table: 'characters',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		// Update characterId if it's a string reference
		if (doc.id && typeof doc.id === 'string') {
			const character = await getCharacterById(ctx, doc.id);
			if (!character) throw new Error(`Can't find character: ${doc.id}`);
			if (character._id !== doc.id) {
				await ctx.db.replace(doc._id, {
					name: character.name,
					img: character.id
				});
			}
		}
	}
});

export const runUpdateCharacters = migrations.runner(internal.migrations.updateCharacters);

export const updateKarts = migrations.define({
	table: 'karts',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		// Update kartId if it's a string reference
		if (doc.id && typeof doc.id === 'string') {
			const kart = await getKartById(ctx, doc.id);
			if (!kart) throw new Error(`Can't find kart: ${doc.id}`);
			if (kart._id !== doc.id) {
				await ctx.db.replace(doc._id, {
					name: kart.name,
					img: kart.id
				});
			}
		}
	}
});

export const runUpdateKarts = migrations.runner(internal.migrations.updateKarts);

export const updateGrandPrix = migrations.define({
	table: 'grandPrix',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		const participantsDocId = Promise.all(
			doc.participants.map(async (participant: number) => {
				return await getUserById(ctx, participant).then((user) => {
					if (user) {
						return user._id;
					} else {
						throw new Error(`Can't find user: ${participant}`);
					}
				});
			})
		).then((res) => {
			return res.sort((a, b) => b.localeCompare(a));
		});

		await ctx.db.replace(doc._id, {
			order: doc.order,
			participants: await participantsDocId
		});
	}
});

export const runUpdateGrandPrix = migrations.runner(internal.migrations.updateGrandPrix);

export const updateUsers = migrations.define({
	table: 'users',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		// Update userId if it's a string reference
		if (doc.id && typeof doc.id === 'number') {
			const user = await getUserById(ctx, doc.id);
			if (!user) throw new Error(`Can't find user: ${doc.id}`);
			if (user._id !== doc.id) {
				await ctx.db.replace(doc._id, {
					name: doc.name
				});
			}
		}
	}
});

export const runUpdateUsers = migrations.runner(internal.migrations.updateUsers);

export const updateTracks = migrations.define({
	table: 'tracks',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		// Update trackId if it's a string reference
		if (doc.id && typeof doc.id === 'string') {
			const track = await getTrackById(ctx, doc.id);
			if (!track) throw new Error(`Can't find track: ${doc.id}`);
			if (track._id !== doc.id) {
				await ctx.db.replace(doc._id, {
					name: track.name,
					img: track.id
				});
			}
		}
	}
});

export const runUpdateTracks = migrations.runner(internal.migrations.updateTracks);

export const updateRaces = migrations.define({
	table: 'races',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		const updates: any = {};

		// Update trackStartId if it's a string reference
		if (doc.track_start_id && typeof doc.track_start_id === 'string') {
			const track = await getTrackById(ctx, doc.track_start_id);
			if (!track) throw new Error(`Can't find track: ${doc.track_start_id}`);
			if (track._id !== doc.track_start_id) {
				updates.trackStartId = track._id;
			}
		}

		// Update trackEndId if it's a string reference
		if (doc.track_end_id && typeof doc.track_end_id === 'string') {
			const track = await getTrackById(ctx, doc.track_end_id);
			if (!track) throw new Error(`Can't find track: ${doc.track_end_id}`);
			if (track._id !== doc.track_end_id) {
				updates.trackEndId = track._id;
			}
		}

		// Update grandPrixId if its a number reference
		if (doc.grand_prix_id && typeof doc.grand_prix_id === 'number') {
			const gp = await getGrandPrixById(ctx, doc.grand_prix_id);
			if (!gp) throw new Error(`Can't find gp: ${doc.grand_prix_id}`);
			updates.grandPrixId = gp._id;
		}

		if (Object.keys(updates).length > 0) {
			await ctx.db.replace(doc._id, {
				...updates,
				order: doc.order,
				transition: doc.transition
			});
		}
	}
});

export const runUpdateRaces = migrations.runner(internal.migrations.updateRaces);

export const updateResults = migrations.define({
	table: 'results',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		const updates: any = {};

		// Update characterId if it's a string reference
		if (doc.character_id && typeof doc.character_id === 'string') {
			const character = await getCharacterById(ctx, doc.character_id);
			if (!character) throw new Error(`Can't find character: ${doc.character_id}`);
			if (character._id !== doc.character_id) {
				updates.characterId = character._id;
			}
		}

		// Update kartId if it's a string reference
		if (doc.kart_id && typeof doc.kart_id === 'string') {
			const kart = await getKartById(ctx, doc.kart_id);
			if (!kart) throw new Error(`Can't find kart: ${doc.kart_id}`);
			if (kart._id !== doc.kart_id) {
				updates.kartId = kart._id;
			}
		}

		// Update userId if it's a string reference
		if (doc.user_id && typeof doc.user_id === 'number') {
			const user = await getUserById(ctx, doc.user_id);
			if (!user) throw new Error(`Can't find user: ${doc.user_id}`);
			if (user._id !== doc.user_id) {
				updates.userId = user._id;
			}
		}

		// Update raceId if it's a string reference
		if (doc.race_id && typeof doc.race_id === 'number') {
			const race = await getRaceById(ctx, doc.race_id);
			if (!race) throw new Error(`Can't find race: ${doc.race_id}`);
			if (race._id !== doc.race_id) {
				updates.raceId = race._id;
			}
		}

		if (Object.keys(updates).length > 0) {
			await ctx.db.replace(doc._id, {
				...updates,
				position: doc.position
			});
		}
	}
});

export const runUpdateResults = migrations.runner(internal.migrations.updateResults);

export const updateGrandPrixStandings = migrations.define({
	table: 'grandPrix',
	batchSize: 10000,
	migrateOne: async (ctx, doc) => {
		const updates: any = {};
		const races = await getRacesByGpId(ctx, doc._id);
		const grandPrixStandings = await getGrandPrixStandingsByGrandPrixId(ctx, doc._id);

		// Delete existing standings
		for (const standing of grandPrixStandings) {
			await ctx.db.delete(standing._id);
		}

		const standings = new Map<
			Id<'users'>,
			{ gpId: Id<'grandPrix'>; userId: Id<'users'>; points: number }
		>();

		// Process races sequentially
		for (const race of races) {
			const raceResults = await getResultsByRaceId(ctx, race._id);
			raceResults.forEach((result) => {
				const currentStanding = standings.get(result.userId);
				if (!currentStanding) {
					standings.set(result.userId, {
						gpId: doc._id,
						userId: result.userId,
						points: placementToPoints[result.position || 0]
					});
				} else {
					currentStanding.points += placementToPoints[result.position || 0];
					standings.set(result.userId, currentStanding);
				}
			});
		}

		// Insert new standings
		for (const standing of Array.from(standings.values())) {
			await ctx.db.insert('grandPrixStandings', {
				grandPrixId: doc._id,
				userId: standing.userId,
				points: standing.points
			});
		}
	}
});

export const runUpdateGrandPrixStandings = migrations.runner(
	internal.migrations.updateGrandPrixStandings
);
