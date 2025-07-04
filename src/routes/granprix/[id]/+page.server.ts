import { db } from '$lib/server/db';
import { granPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const raceList = await db
		.select({
			id: races.id,
			order: races.order,
			name: tracks.name
		})
		.from(races)
		.innerJoin(tracks, eq(races.trackStartId, tracks.id))
		.where(eq(races.granPrixId, Number(params.id)));

	const [granPrixDetails] = await db
		.select()
		.from(granPrix)
		.where(eq(granPrix.id, Number(params.id)))
		.limit(1);

	const raceResults = await db
		.select()
		.from(results)
		.innerJoin(races, eq(results.raceId, races.id))
		.where(eq(races.granPrixId, Number(params.id)));

	const userList = await db.select().from(users);

	return {
		userList,
		raceList,
		granPrixDetails,
		raceResults
	};
};
