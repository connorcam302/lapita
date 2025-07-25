import { query } from './_generated/server';

export const all = query({
	handler: async (ctx) => {
		return ctx.db.query('karts').withIndex('name').collect();
	}
});
