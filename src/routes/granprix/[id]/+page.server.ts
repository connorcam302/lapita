import { db } from '$lib/server/db';
import { characters, granPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getRaceResultsByGpId } from '$lib/server/serverUtils';

export const load: PageServerLoad = async ({ params }) => {
	const [granPrixDetails] = await db
		.select()
		.from(granPrix)
		.where(eq(granPrix.id, Number(params.id)))
		.limit(1);

	const initialRaceResults = await getRaceResultsByGpId(params.id);

	const userList = await db
		.select()
		.from(users)
		.where(inArray(users.id, await granPrixDetails.participants))
		.orderBy(asc(users.name));

	const characterList = await db.select().from(characters).orderBy(asc(characters.name));

	return {
		userList,
		granPrixDetails,
		initialRaceResults,
		characterList
	};
};
