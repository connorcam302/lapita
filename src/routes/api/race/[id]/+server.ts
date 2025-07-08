import { db } from '$lib/server/db';
import { results, races } from '$lib/server/db/schema';
import { json, type RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, params }) => {
	const { position, userId, characterId } = await request.json();

	if (!position || !userId || !characterId) {
		return error(400, { message: 'Missing required fields' });
	}

	await db
		.update(results)
		.set({
			position,
			characterId
		})
		.where(and(eq(results.userId, userId), eq(results.raceId, Number(params.id))))
		.returning();

	return json({ message: 'Success' });
};

export const PUT: RequestHandler = async ({ request, params }) => {
	const { trackStartId, trackEndId } = await request.json();

	if (!trackStartId || !trackEndId) {
		return error(400, { message: 'Missing required fields' });
	}

	await db
		.update(races)
		.set({
			trackStartId,
			trackEndId
		})
		.where(eq(races.id, Number(params.id)))
		.returning();

	return json({ message: 'Success' });
};
