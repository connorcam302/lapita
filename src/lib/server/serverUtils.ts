import { db } from '$lib/server/db';
import { granPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const getRaceResultsByGpId = async (gpId: string | number) => {
	const [granPrixDetails] = await db
		.select()
		.from(granPrix)
		.where(eq(granPrix.id, Number(gpId)))
		.limit(1);

	const startTrack = alias(tracks, 'start_track');
	const endTrack = alias(tracks, 'end_track');

	const allResults = await db
		.select({
			results,
			races,
			users,
			startTrackName: startTrack.name,
			endTrackName: endTrack.name
		})
		.from(results)
		.innerJoin(races, eq(results.raceId, races.id))
		.innerJoin(startTrack, eq(races.trackStartId, startTrack.id))
		.innerJoin(endTrack, eq(races.trackEndId, endTrack.id))
		.innerJoin(users, eq(results.userId, users.id))
		.where(eq(races.granPrixId, Number(gpId)))
		.orderBy(asc(races.order));

	console.log(allResults);

	let raceResults = [];
	for (let i = 0; i < 16; i++) {
		const racesForOrder = allResults.filter((result) => result.races.order === i);
		if (racesForOrder.length === 0) continue;

		raceResults.push({
			...racesForOrder[0].races,
			startTrackName: racesForOrder[0].startTrackName,
			endTrackName: racesForOrder[0].endTrackName,
			results: racesForOrder
				.map((result) => ({
					id: result.results.id,
					name: result.users.name,
					userId: result.results.userId,
					position: result.results.position
				}))
				.sort((a, b) => a.name.localeCompare(b.name))
		});
	}

	return raceResults;
};
