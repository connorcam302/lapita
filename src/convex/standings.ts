import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { Id } from './_generated/dataModel';

export const getOne = query({
	args: { grandPrixId: v.id('grandPrix') },
	handler: async (ctx, { grandPrixId }) => {
		return await ctx.db
			.query('grandPrixStandings')
			.withIndex('grandPrixId', (q) => q.eq('grandPrixId', grandPrixId))
			.collect()
			.then((res) => {
				return res
					.sort((a, b) => b.points - a.points)
					.map((standing, index, sortedArray) => {
						// Find position by looking for the first occurrence of this point value
						const position = sortedArray.findIndex((s) => s.points === standing.points) + 1;
						return {
							userId: standing.userId,
							points: standing.points,
							position
						};
					})
					.sort((a, b) => b.points - a.points);
			});
	}
});
