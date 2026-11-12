import { v } from 'convex/values';
import { query } from './_generated/server';
import { aggregatePlayerDirectory } from '../lib/player-directory';

export const getAllUsers = query({
	handler: async (ctx) => {
		return await ctx.db.query('users').collect();
	}
});

export const getOne = query({
	args: { id: v.id('users') },
	handler: async (ctx, { id }) => {
		return await ctx.db
			.query('users')
			.withIndex('by_id', (q) => q.eq('_id', id))
			.unique();
	}
});

/** One subscription returns summary rows only, never individual player histories. */
export const directory = query({
	args: {},
	handler: async (ctx) => {
		const [users, gps, races, results] = await Promise.all([
			ctx.db.query('users').collect(),
			ctx.db.query('grandPrix').collect(),
			ctx.db.query('races').collect(),
			ctx.db.query('results').collect()
		]);
		return aggregatePlayerDirectory(users, gps, races, results);
	}
});
