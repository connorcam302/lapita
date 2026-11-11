import { query } from './_generated/server';
import { calculateRecords } from '../lib/records';

export const get = query({
	args: {},
	handler: async (ctx) => {
		const [users, gps, races, results] = await Promise.all([
			ctx.db.query('users').collect(),
			ctx.db.query('grandPrix').collect(),
			ctx.db.query('races').collect(),
			ctx.db.query('results').collect()
		]);
		return calculateRecords(users, gps, races, results);
	}
});
