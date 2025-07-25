import { db } from '$lib/server/db';
import { grandPrix, races, results, tracks, users } from '$lib/server/db/schema';
import { and, asc, avg, count, desc, eq, inArray, isNotNull, lte, min, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { placementToPoints } from '$lib/utils';
import { allTracks } from '$lib/data/allTracks';

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
					placementToPoints;
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
	const allGps = await db.select().from(grandPrix).orderBy(desc(grandPrix.order));

	const forEachGp = allGps.map(async (gp) => {
		const raceResults = await getRaceResultsByGpId(gp.id);
		return {
			...gp,
			standings: raceResults
		};
	});

	const allResults = await Promise.all(forEachGp).then((gps) => {
		return gps.map((gp) => {
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

export const getAveragePositionsByTracksLastFive = async (
	userIds: number[],
	trackIds: string[]
) => {
	const lastFiveRacesSubquery = db.$with('latest_races').as(
		db
			.select({
				id: races.id,
				userId: results.userId,
				trackId: races.trackStartId,
				order: races.order,
				rn: sql<number>`row_number() OVER (PARTITION BY ${results.userId}, ${races.trackStartId} ORDER BY ${races.order} DESC)`.as(
					'rn'
				)
			})
			.from(results)
			.innerJoin(races, eq(results.raceId, races.id))
			.where(and(inArray(races.trackStartId, trackIds), inArray(results.userId, userIds)))
	);

	return await db
		.with(lastFiveRacesSubquery)
		.select({
			userId: results.userId,
			name: users.name,
			trackId: races.trackStartId,
			positions: sql<number>`array_agg(${results.position} ORDER BY ${races.order} DESC)`,
			avgPosition: avg(results.position).as('avgPosition')
		})
		.from(results)
		.innerJoin(
			lastFiveRacesSubquery,
			and(
				eq(results.raceId, lastFiveRacesSubquery.id),
				eq(results.userId, lastFiveRacesSubquery.userId) // This is the key addition
			)
		)
		.innerJoin(users, eq(results.userId, users.id))
		.innerJoin(races, eq(results.raceId, races.id))
		.where(lte(lastFiveRacesSubquery.rn, 5))
		.groupBy(results.userId, races.trackStartId, users.name);
};

export const getBestPositionsByTracks = async (userIds: number[], trackIds: string[]) => {
	const rankedResultsSubquery = db.$with('ranked_results').as(
		db
			.select({
				raceResultId: results.id,
				userId: results.userId,
				trackId: races.trackStartId,
				rn: sql<number>`row_number() OVER (PARTITION BY ${results.userId}, ${races.trackStartId} ORDER BY ${results.position} ASC, ${races.order} DESC)`.as(
					'rn'
				)
			})
			.from(results)
			.innerJoin(races, eq(results.raceId, races.id))
			.where(
				and(
					// Filter data early in the CTE for performance
					inArray(races.trackStartId, trackIds),
					inArray(results.userId, userIds)
				)
			)
	);

	return await db
		.with(rankedResultsSubquery) // Use the CTE we defined
		.select({
			userId: results.userId,
			name: users.name,
			trackId: races.trackStartId,
			position: results.position
		})
		.from(results)
		.innerJoin(races, eq(results.raceId, races.id))
		.innerJoin(users, eq(results.userId, users.id))
		.innerJoin(rankedResultsSubquery, eq(results.id, rankedResultsSubquery.raceResultId))
		.where(eq(rankedResultsSubquery.rn, 1));
};

export const getAveragePositionsByTracks = async (userIds: number[], trackIds: string[]) => {
	return await db
		.select({
			userId: results.userId,
			name: users.name,
			trackId: races.trackStartId,
			avg: avg(results.position),
			count: count(results.userId)
		})
		.from(results)
		.innerJoin(races, eq(results.raceId, races.id))
		.innerJoin(users, eq(results.userId, users.id))
		.where(
			and(
				inArray(races.trackStartId, trackIds),
				inArray(races.trackStartId, trackIds),
				inArray(results.userId, userIds)
			)
		)
		.groupBy(results.userId, races.trackStartId, users.name);
};
