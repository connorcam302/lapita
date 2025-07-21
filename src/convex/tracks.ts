import { mutation, query } from './_generated/server';

export const valid = query({
	handler: async (ctx) => {
		return ctx.db
			.query('tracks')
			.filter((q) => q.neq(q.field('name'), 'Rainbow Road'))
			.collect();
	}
});

export const all = query({
	handler(ctx) {
		return ctx.db.query('tracks').collect();
	}
});
