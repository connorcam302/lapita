import { query } from './_generated/server';
import { calculateRecords } from '../lib/records';
import { calculateStats } from '../lib/stats';

export const get = query({
	args: {},
	handler: async (ctx) => {
		const [users, gps, races, results] = await Promise.all([
			ctx.db.query('users').collect(),
			ctx.db.query('grandPrix').collect(),
			ctx.db.query('races').collect(),
			ctx.db.query('results').collect()
		]);
		return calculateRecords(
			users,
			gps.filter((gp) => gp.deletedAt === undefined),
			races,
			results
		);
	}
});

/** All-time dashboard, aggregated server-side to keep raw history out of the browser. */
export const stats = query({
	args: {},
	handler: async (ctx) => {
		const [users, gps, races, results, tracks, characters, karts] = await Promise.all([
			ctx.db.query('users').collect(),
			ctx.db.query('grandPrix').collect(),
			ctx.db.query('races').collect(),
			ctx.db.query('results').collect(),
			ctx.db.query('tracks').collect(),
			ctx.db.query('characters').collect(),
			ctx.db.query('karts').collect()
		]);
		return calculateStats(users, gps, races, results, tracks, characters, karts);
	}
});
