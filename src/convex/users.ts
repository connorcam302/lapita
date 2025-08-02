import { v } from 'convex/values';
import { query } from './_generated/server';

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
