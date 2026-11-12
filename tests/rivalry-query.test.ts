import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { get } from '../src/convex/rivalry';
import type { api } from '../src/convex/_generated/api';
import type { QueryCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';

type Row = { _id: string; [key: string]: unknown };
function fixture() {
	const tables: Record<string, Row[]> = {
		users: [{ _id: 'a' }, { _id: 'b' }],
		grandPrix: Array.from({ length: 8 }, (_, i) => ({
			_id: `gp${i}`,
			order: i,
			participants: ['a', 'b'],
			...(i === 6 ? { deletedAt: 100 } : {})
		})),
		races: Array.from({ length: 8 }, (_, i) => ({
			_id: `race${i}`,
			grandPrixId: `gp${i}`,
			order: 0,
			trackStartId: 'start',
			trackEndId: 'end'
		})),
		results: Array.from({ length: 8 }, (_, i) =>
			['a', 'b'].map((userId) => ({
				_id: `${userId}${i}`,
				raceId: `race${i}`,
				userId,
				position: userId === 'a' ? 1 : 2
			}))
		).flat()
	};
	const indexes: string[] = [];
	const ctx = {
		db: {
			get: async (id: string) =>
				Object.values(tables)
					.flat()
					.find((r) => r._id === id) ?? null,
			query: (table: string) => {
				let rows = [...tables[table]];
				const chain = {
					withIndex(index: string, callback?: (q: unknown) => unknown) {
						indexes.push(`${table}.${index}`);
						callback?.({
							eq: (field: string, value: unknown) => {
								rows = rows.filter((r) => r[field] === value);
							}
						});
						return chain;
					},
					order: () => {
						rows.sort((a, b) => Number(b.order) - Number(a.order));
						return chain;
					},
					filter: () => {
						rows = rows.filter((r) => r.deletedAt === undefined);
						return chain;
					},
					take: async (n: number) => rows.slice(0, n),
					collect: async () => rows
				};
				return chain;
			}
		}
	} as unknown as QueryCtx;
	const run = (scope: 'all' | '5' | '10' | '20' = 'all', a = 'a', b = 'b') =>
		(
			get as unknown as {
				_handler: (
					ctx: QueryCtx,
					args: FunctionArgs<typeof api.rivalry.get>
				) => Promise<FunctionReturnType<typeof api.rivalry.get>>;
			}
		)._handler(ctx, { playerA: a as Id<'users'>, playerB: b as Id<'users'>, scope });
	return { tables, indexes, run };
}

test('query excludes deleted GPs, missing parents, nonparticipants and one-sided/invalid finishes', async () => {
	const { tables, indexes, run } = fixture();
	tables.results = tables.results.filter((r) => r._id !== 'b0');
	tables.results.find((r) => r._id === 'b1')!.position = 2.5;
	tables.grandPrix.find((r) => r._id === 'gp2')!.participants = ['a'];
	tables.grandPrix = tables.grandPrix.filter((r) => r._id !== 'gp3');
	tables.races = tables.races.filter((r) => r._id !== 'race4');
	const result = await run();
	assert.deepEqual(
		result.races.map((r) => r.gpOrder),
		[5, 7]
	);
	assert.equal(result.aPoints, 30);
	assert.equal(result.bPoints, 24);
	assert.ok(result.tracks.every((t) => t.trackId === 'end'));
	assert.deepEqual(indexes, ['results.userId', 'results.userId']);
});

test('latest scope selects active GPs globally before intersecting participants', async () => {
	const { tables, run, indexes } = fixture();
	// GP 7 consumes a recent slot even when these racers did not enter it.
	tables.grandPrix.find((r) => r._id === 'gp7')!.participants = [];
	const recent = await run('5');
	assert.deepEqual(
		recent.races.map((r) => r.gpOrder),
		[2, 3, 4, 5]
	);
	assert.ok(indexes.includes('grandPrix.order'));
	assert.equal((await run('10')).count, 6);
	assert.equal((await run('20')).count, 6);
});

test('query rejects same-player and missing-player requests', async () => {
	const { run } = fixture();
	await assert.rejects(run('all', 'a', 'a'), /different players/);
	await assert.rejects(run('all', 'a', 'missing'), /Player not found/);
});
