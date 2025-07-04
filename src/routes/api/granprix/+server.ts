import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { granPrix } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const data = await db.select().from(granPrix);

	return json(data);
};

export const POST: RequestHandler = async () => {
	const newGranPrix = await db.insert(granPrix).values({}).returning();

	return json(newGranPrix);
};
