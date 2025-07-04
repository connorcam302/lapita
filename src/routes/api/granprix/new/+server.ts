import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { granPrix, races } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { validTracks } from '$lib/data/allTracks';
import { desc, eq } from 'drizzle-orm';

export const POST: RequestHandler = async () => {
	const tracks = validTracks;

	// select 16 random tracks from valid tracks
	const trackList = tracks.sort(() => Math.random() - 0.5).slice(0, 16);

	const liveGP = await db.select().from(granPrix).where(eq(granPrix.live, true));

	try {
		if (liveGP.length > 0) {
			return json({ error: 'There is already a live GP' }, { status: 409 });
		}

		const latestGP = await db.select().from(granPrix).orderBy(desc(granPrix.order)).limit(1);
		const newGranPrix = await db
			.insert(granPrix)
			.values({ order: latestGP[0].order + 1 || 0 })
			.returning();

		if (!newGranPrix?.[0]) {
			return json({ error: 'Failed to create Gran Prix' }, { status: 500 });
		}

		const granPrixId = newGranPrix[0].id;

		await db.insert(races).values(
			trackList.map((track, i) => ({
				order: i,
				granPrixId,
				trackStartId: track.id,
				trackEndId: track.id
			}))
		);

		return json(newGranPrix[0]);
	} catch (e) {
		console.error(e);
		return json({ error: 'An unexpected error occurred.' }, { status: 500 });
	}
};
