import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { grandPrix, races, results } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';
import { validTracks, allTracks } from '$lib/data/allTracks';
import { and, asc, desc, eq, or } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, params }) => {
	const { id, userId } = params;

	let participants = await db
		.select()
		.from(grandPrix)
		.where(eq(grandPrix.id, Number(id)));

	console.log(participants);
	participants = participants[0].participants;

	if (participants.includes(Number(userId))) {
		return error(400, 'Participant already included');
	}

	const [exampleParticipantId] = participants;

	const raceList = await db
		.select({ raceId: results.raceId })
		.from(results)
		.innerJoin(races, eq(races.id, results.raceId))
		.where(and(eq(results.userId, exampleParticipantId), eq(races.grandPrixId, Number(id))));

	const gpUpdate = await db
		.update(grandPrix)
		.set({ participants: [participants, Number(userId)].sort() })
		.where(eq(grandPrix.id, Number(id)));

	const resultsUpdate = await db.insert(results).values(
		raceList.map((race) => {
			return {
				userId,
				raceId: race.raceId
			};
		})
	);

	return json({ gpUpdate, resultsUpdate });
};
