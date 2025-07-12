import { db } from '$lib/server/db';
import { characters, grandPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import {
	calculateRaceWinChance,
	getRaceResultsByGpId,
	getAveragePositionsByTracks
} from '$lib/server/serverUtils';

export const load: PageServerLoad = async ({ params }) => {
	const [grandPrixDetails] = await db
		.select()
		.from(grandPrix)
		.where(eq(grandPrix.id, Number(params.id)))
		.limit(1);

	const initialRaceResults = await getRaceResultsByGpId(params.id);

	const participants = await grandPrixDetails.participants;

	const userList = await db
		.select()
		.from(users)
		.where(inArray(users.id, participants))
		.orderBy(asc(users.name));

	const characterList = await db.select().from(characters).orderBy(asc(characters.name));

	const races = initialRaceResults.map((race) => race.trackStartId);

	const trackAverages = await getAveragePositionsByTracks(participants, races);

	const winChances = calculateRaceWinChance(trackAverages, [], 0);

	return {
		userList,
		grandPrixDetails,
		initialRaceResults,
		characterList,
		winChances
	};
};
