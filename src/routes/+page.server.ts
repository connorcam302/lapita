import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const leaderboard = {
		gpId: 1,
		standings: [
			{
				position: 1,
				username: 'Tom',
				character: 'Wiggler',
				score: 185
			},
			{
				position: 2,
				username: 'Connor',
				character: 'Mario',
				score: 183
			},
			{
				position: 3,
				username: 'Callum',
				character: 'Peach',
				score: 164
			},
			{
				position: 4,
				username: 'Matthew',
				character: 'Bowser',
				score: 163
			}
		]
	};

	const playerList = await db.select().from(users).orderBy(asc(users.name));

	return { leaderboard, playerList };
};
