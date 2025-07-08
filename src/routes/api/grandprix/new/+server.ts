import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { grandPrix, races, results } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { validTracks } from '$lib/data/allTracks';
import { desc } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const { participants } = await request.json();
	participants.sort();
	if (!participants || !Array.isArray(participants) || participants.some(isNaN)) {
		return json({ error: 'Invalid participants payload' }, { status: 400 });
	}

	const tracks = validTracks;

	// select 16 random tracks from valid tracks
	const trackList = tracks.sort(() => Math.random() - 0.5).slice(0, 16);

	try {
		const latestGP = await db.select().from(grandPrix).orderBy(desc(grandPrix.order)).limit(1);
		const newgrandPrix = await db
			.insert(grandPrix)
			.values({ order: (latestGP[0]?.order ?? -1) + 1, participants })
			.returning();

		if (!newgrandPrix?.[0]) {
			return json({ error: 'Failed to create grand Prix' }, { status: 500 });
		}

		const grandPrixId = newgrandPrix[0].id;
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

		return json(newgrandPrix[0]);
	} catch (e) {
		console.error(e);
		return json({ error: 'An unexpected error occurred.' }, { status: 500 });
	}
};
