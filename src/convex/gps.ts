import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

export const get = query({
	args: {},
	handler: async (ctx) => {
		const gps = await ctx.db.query('grandPrix').collect();

		return gps;
	}
});

export const new = mutation({
	args: {participants: v.array(v.id('users'))},
	handler: async (ctx, {participants}) => {

	const [gpMinus2, gpMinus1] = await ctx.db.query('grandPrix').withIndex('order').order('desc').take(2)
const oldGpTracks = await ctx.db
  .query('races')
  .filter(q =>
    q.or(
      q.eq(q.field('grandPrixId'), gpMinus2._id),
      q.eq(q.field('grandPrixId'), gpMinus1._id)
    )
  )
  .collect();

		const validTracks = await ctx.db.query('tracks').filter((q) => q.neq(q.field('name'), 'Rainbow Road')).collect();


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

	try {
		const latestGP = await db.select().from(grandPrix).orderBy(desc(grandPrix.order)).limit(1);

		const newGrandPrix = await db
			.insert(grandPrix)
			.values({ order: (latestGP[0]?.order ?? -1) + 1, participants })
			.returning();

		if (!newGrandPrix?.[0]) {
			return json({ error: 'Failed to create grand Prix' }, { status: 500 });
		}

		const grandPrixId = newGrandPrix[0].id;
		const raceList = await db
			.insert(races)
			.values(
				trackList.map((track, i) => ({
					order: i,
					grandPrixId,
					trackStartId: track.id,
					trackEndId: track.id
				}))
			)
			.returning();

		await db.insert(results).values(
			participants.flatMap((userId) =>
				raceList.map((race) => ({
					userId,
					raceId: race.id
				}))
			)
		);

		return json(newGrandPrix[0]);
	} catch (e) {
		console.error(e);
		return json({ error: 'An unexpected error occurred.' }, { status: 500 });
	}
	}
})
