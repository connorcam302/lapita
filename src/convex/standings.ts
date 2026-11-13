import { v } from 'convex/values';
import { query } from './_generated/server';
import { rankGrandPrixStandings } from '../lib/grand-prix';

export const getOne = query({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		const gp = await ctx.db.get(grandPrixId);
		if (!gp || gp.deletedAt !== undefined) return [];
		const standings = await ctx.db
			.query('grandPrixStandings')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect();
		return rankGrandPrixStandings(standings, gp.knockoutWinnerId).map(
			({ userId, points, position }) => ({ userId, points, position })
		);
	}
});
