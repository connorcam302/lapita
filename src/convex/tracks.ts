import { v } from 'convex/values';
import { query } from './_generated/server';

export const valid = query({
	handler: async (ctx) => {
		return ctx.db
			.query('tracks')
			.filter((q) => q.neq(q.field('name'), 'Rainbow Road'))
			.collect();
	}
});

export const all = query({
	handler: async (ctx) => {
		return ctx.db.query('tracks').collect();
	}
});

/** Track stats follow the overview: transitions belong to their finishing track. */
export const detail = query({
	args: { id: v.string() },
	handler: async (ctx, { id }) => {
		const trackId = ctx.db.normalizeId('tracks', id);
		const track = trackId ? await ctx.db.get(trackId) : null;
		if (!track) return null;
		const races = await ctx.db
			.query('races')
			.withIndex('trackEndId', (q) => q.eq('trackEndId', track._id))
			.collect();
		const history = await Promise.all(
			races.map(async (race) => {
				const [grandPrix, results] = await Promise.all([
					ctx.db.get(race.grandPrixId),
					ctx.db
						.query('results')
						.withIndex('raceId', (q) => q.eq('raceId', race._id))
						.collect()
				]);
				return {
					...race,
					grandPrixOrder: grandPrix?.order ?? null,
					participants: grandPrix?.participants ?? [],
					results
				};
			})
		);
		history.sort(
			(a, b) =>
				(b.grandPrixOrder ?? -1) - (a.grandPrixOrder ?? -1) ||
				b.order - a.order ||
				b._creationTime - a._creationTime
		);
		return { track, races: history };
	}
});
