import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { QueryCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';
import { stats } from '../src/convex/results';

test('starting history excludes the selected and later GPs', async () => {
	const gps = [1, 2, 3].map((order) => ({ _id: `gp${order}`, order }));
	const rows: Record<string, Record<string, unknown>[]> = {
		grandPrix: gps,
		races: gps.map((gp) => ({
			_id: `race${gp.order}`,
			grandPrixId: gp._id,
			trackStartId: 'track',
			trackEndId: 'track'
		})),
		results: gps.map((gp) => ({ raceId: `race${gp.order}`, userId: 'player', position: gp.order }))
	};
	const db = {
		get: async (id: string) => gps.find((gp) => gp._id === id) ?? null,
		query(table: string) {
			const filters: [string, unknown][] = [];
			const builder = {
				eq(field: string, value: unknown) {
					filters.push([field, value]);
					return builder;
				}
			};
			const collect = async () =>
				rows[table].filter((row) => filters.every(([key, value]) => row[key] === value));
			return {
				withIndex(_name: string, callback: (q: typeof builder) => unknown) {
					callback(builder);
					return { collect, unique: async () => (await collect())[0] ?? null };
				}
			};
		}
	};
	const ctx = { db } as unknown as QueryCtx;
	const args = { tracks: ['track' as Id<'tracks'>], users: ['player' as Id<'users'>] };
	const runStats = (
		stats as unknown as {
			_handler: (
				ctx: QueryCtx,
				input: typeof args & { beforeGrandPrixId?: Id<'grandPrix'> }
			) => Promise<{ stats: { avg: number; count: number }[] }[]>;
		}
	)._handler;
	const starting = await runStats(ctx, {
		...args,
		beforeGrandPrixId: 'gp2' as Id<'grandPrix'>
	});
	assert.equal(starting[0].stats[0].avg, 1);
	assert.equal(starting[0].stats[0].count, 1);
	const ongoing = await runStats(ctx, args);
	assert.equal(ongoing[0].stats[0].avg, 2);
	assert.equal(ongoing[0].stats[0].count, 3);
	const first = await runStats(ctx, { ...args, beforeGrandPrixId: 'gp1' as Id<'grandPrix'> });
	assert.deepEqual(first[0].stats, []);
});
