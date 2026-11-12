import { v } from 'convex/values';
import { query } from './_generated/server';
import { summarizeRivalry, type RivalryRace } from '../lib/rivalry';

export const get = query({
	args: {
		playerA: v.id('users'),
		playerB: v.id('users'),
		scope: v.union(v.literal('all'), v.literal('5'), v.literal('10'), v.literal('20'))
	},
	handler: async (ctx, { playerA, playerB, scope }) => {
		if (playerA === playerB) throw new Error('Choose two different players.');
		const [aUser, bUser] = await Promise.all([ctx.db.get(playerA), ctx.db.get(playerB)]);
		if (!aUser || !bUser) throw new Error('Player not found.');
		// Scope is the latest active GPs globally, before intersecting the players' results.
		const recent =
			scope === 'all'
				? null
				: await ctx.db
						.query('grandPrix')
						.withIndex('order')
						.order('desc')
						.filter((q) => q.eq(q.field('deletedAt'), undefined))
						.take(Number(scope));
		const allowed = recent ? new Set(recent.map((gp) => gp._id)) : null;
		const [aResults, bResults] = await Promise.all(
			[playerA, playerB].map((userId) =>
				ctx.db
					.query('results')
					.withIndex('userId', (q) => q.eq('userId', userId))
					.collect()
			)
		);
		const bByRace = new Map(bResults.map((r) => [r.raceId, r]));
		const paired = aResults.filter((r) => bByRace.has(r.raceId));
		const races = await Promise.all(paired.map((r) => ctx.db.get(r.raceId)));
		const gpIds = [...new Set(races.flatMap((r) => (r ? [r.grandPrixId] : [])))];
		const gps = await Promise.all(gpIds.map((id) => ctx.db.get(id)));
		const active = new Map(
			gps
				.filter(
					(gp) =>
						gp &&
						gp.deletedAt === undefined &&
						(!allowed || allowed.has(gp._id)) &&
						gp.participants.includes(playerA) &&
						gp.participants.includes(playerB)
				)
				.map((gp) => [gp!._id, gp!])
		);
		const rows: RivalryRace[] = [];
		for (const [index, result] of paired.entries()) {
			const race = races[index];
			const gp = race && active.get(race.grandPrixId);
			if (!race || !gp) continue;
			rows.push({
				raceId: race._id,
				grandPrixId: gp._id,
				gpOrder: gp.order,
				raceOrder: race.order,
				trackId: race.trackEndId,
				aPosition: result.position,
				bPosition: bByRace.get(race._id)!.position
			});
		}
		return summarizeRivalry(rows);
	}
});
