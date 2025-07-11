import { db } from '$lib/server/db';
import { grandPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { placementToPoints } from '$lib/utils';

export const getRaceResultsByGpId = async (gpId: string | number) => {
	const [grandPrixDetails] = await db
		.select()
		.from(grandPrix)
		.where(eq(grandPrix.id, Number(gpId)))
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
		.where(eq(races.grandPrixId, Number(gpId)))
		.orderBy(asc(races.order));

	let raceResults = [];
	const cumulativePoints: Record<number, number> = {};
	for (let i = 0; i < 16; i++) {
		const racesForOrder = allResults.filter((result) => result.races.order === i);
		if (racesForOrder.length === 0) continue;

		raceResults.push({
			...racesForOrder[0].races,
			startTrackName: racesForOrder[0].startTrackName,
			endTrackName: racesForOrder[0].endTrackName,
			results: racesForOrder
				.map((result) => {
					const points = placementToPoints[result.results.position || 0] || 0;
					cumulativePoints[result.results.userId] =
						(cumulativePoints[result.results.userId] || 0) + points;
					return {
						id: result.results.id,
						name: result.users.name,
						userId: result.results.userId,
						position: result.results.position,
						points: points,
						cumulativePoints: cumulativePoints[result.results.userId]
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name))
		});
	}

	return raceResults;
};

export const getAllGpStandings = async () => {
	const allGps = await db.select().from(grandPrix);

	const forEachGp = allGps.map(async (gp) => {
		const raceResults = await getRaceResultsByGpId(gp.id);
		return {
			...gp,
			standings: raceResults
		};
	});

	const allResults = await Promise.all(forEachGp).then((gps) => {
		return gps.map((gp) => {
			console.log(gp);
			return {
				...gp,
				standings: gp.standings[gp.standings.length - 1].results
					.map((result) => {
						return {
							position: result.position,
							username: result.name,
							character: result.name,
							score: result.cumulativePoints
						};
					})
					.sort((a, b) => b.score - a.score)
			};
		});
	});

	return allResults;
};
