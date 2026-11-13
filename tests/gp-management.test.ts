import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MutationCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';
import { activeGpRows } from '../src/convex/gp_visibility';
import {
	addRacers,
	remove,
	restore,
	newGp,
	setComplete,
	recordKnockoutResult,
	getPlayerResults
} from '../src/convex/gps';

type Row = { _id: string; [key: string]: unknown };
function fixture() {
	const rows: Record<string, Row[]> = {
		users: [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }],
		grandPrix: [
			{ _id: 'gp', participants: ['a'] },
			{ _id: 'other', participants: ['b'] }
		],
		races: [
			{ _id: 'r1', grandPrixId: 'gp' },
			{ _id: 'r2', grandPrixId: 'gp' },
			{ _id: 'r3', grandPrixId: 'other' }
		],
		results: [
			{ _id: 'saved', raceId: 'r1', userId: 'a', position: 1 },
			{ _id: 'outside', raceId: 'r3', userId: 'b', position: 2 }
		],
		grandPrixStandings: [
			{ _id: 's1', grandPrixId: 'gp', userId: 'a', points: 15 },
			{ _id: 's2', grandPrixId: 'other', userId: 'b', points: 12 }
		]
	};
	const find = (id: string) =>
		Object.values(rows)
			.flat()
			.find((row) => row._id === id);
	let writes = 0;
	const db = {
		get: async (id: string) => find(id) ?? null,
		query(table: string) {
			return {
				withIndex(_index: string, callback: (q: unknown) => unknown) {
					let field: string, value: unknown;
					callback({
						eq(f: string, v: unknown) {
							field = f;
							value = v;
						}
					});
					return {
						collect: async () => rows[table].filter((row) => row[field] === value),
						unique: async () => rows[table].find((row) => row[field] === value) ?? null
					};
				}
			};
		},
		async insert(table: string, value: object) {
			rows[table].push({ _id: `insert-${++writes}`, ...value });
		},
		async patch(id: string, value: object) {
			writes++;
			Object.assign(find(id)!, value);
		},
		async delete(id: string) {
			writes++;
			for (const table in rows) rows[table] = rows[table].filter((row) => row._id !== id);
		}
	};
	const ctx = { db } as unknown as MutationCtx;
	const add = (users: string[], gp = 'gp') =>
		(
			addRacers as unknown as {
				_handler: (
					ctx: MutationCtx,
					args: { grandPrixId: Id<'grandPrix'>; userIds: Id<'users'>[] }
				) => Promise<void>;
			}
		)._handler(ctx, { grandPrixId: gp as Id<'grandPrix'>, userIds: users as Id<'users'>[] });
	const del = () =>
		(
			remove as unknown as {
				_handler: (ctx: MutationCtx, args: { grandPrixId: Id<'grandPrix'> }) => Promise<void>;
			}
		)._handler(ctx, { grandPrixId: 'gp' as Id<'grandPrix'> });
	const recover = () =>
		(
			restore as unknown as {
				_handler: (ctx: MutationCtx, args: { grandPrixId: Id<'grandPrix'> }) => Promise<void>;
			}
		)._handler(ctx, { grandPrixId: 'gp' as Id<'grandPrix'> });
	return {
		recover,
		rows,
		ctx,
		find,
		add,
		del,
		get writes() {
			return writes;
		}
	};
}

test('add racers to every race with zero standings, preserving existing and outside results', async () => {
	const f = fixture();
	await f.add(['a', 'b', 'b', 'c']);
	assert.deepEqual(f.find('gp')!.participants, ['a', 'b', 'c']);
	for (const userId of ['b', 'c']) {
		assert.equal(
			f.rows.grandPrixStandings.find((row) => row.grandPrixId === 'gp' && row.userId === userId)!
				.points,
			0
		);
		assert.deepEqual(
			f.rows.results
				.filter((row) => row.userId === userId && row.raceId !== 'r3')
				.map((row) => [row.raceId, row.position]),
			[
				['r1', undefined],
				['r2', undefined]
			]
		);
	}
	assert.equal(f.find('saved')!.position, 1);
	assert.equal(f.find('outside')!.position, 2);
	const count = f.rows.results.length;
	await f.add(['b', 'c']);
	assert.equal(f.rows.results.length, count);
	assert.equal(f.rows.grandPrixStandings.length, 4);
});

test('reject missing GP, missing users and empty selections before writing', async () => {
	for (const [users, gp] of [
		[['b'], 'missing'],
		[['b', 'missing'], 'gp'],
		[[], 'gp']
	] as [string[], string][]) {
		const f = fixture();
		await assert.rejects(f.add(users, gp));
		assert.equal(f.writes, 0);
	}
});

test('delete and restore preserve every document and ID, and retries are harmless', async () => {
	const f = fixture();
	await f.add(['b']);
	const before = structuredClone(f.rows);
	await f.del();
	assert.equal(typeof f.find('gp')!.deletedAt, 'number');
	const deletedAt = f.find('gp')!.deletedAt;
	await f.del();
	assert.equal(f.find('gp')!.deletedAt, deletedAt);
	await assert.rejects(f.add(['c']), /unavailable/);
	for (const table of ['results', 'races', 'grandPrixStandings', 'users'])
		assert.deepEqual(f.rows[table], before[table]);
	assert.equal(f.find('other')!.deletedAt, undefined);
	await f.recover();
	assert.equal(f.find('gp')!.deletedAt, undefined);
	await f.recover();
	// Convex removes fields patched to undefined; the fixture retains the undefined key.
	delete f.find('gp')!.deletedAt;
	assert.deepEqual(f.rows, before);
});

test('creation works with zero or one prior GP and awaits every related insert', async () => {
	for (const previous of [[], [{ _id: 'prior', order: 4 }]]) {
		const inserted: { table: string; value: Record<string, unknown> }[] = [];
		const ctx = {
			db: {
				query(table: string) {
					return {
						withIndex: () =>
							table === 'grandPrix'
								? {
										order: () => ({
											first: async () => previous[0] ?? null,
											filter: () => ({ take: async () => previous })
										})
									}
								: { collect: async () => [] }
					};
				},
				async insert(table: string, value: Record<string, unknown>) {
					await new Promise((resolve) => setImmediate(resolve));
					inserted.push({ table, value });
					return table + inserted.length;
				}
			},
			runQuery: async () => [{ _id: 'track' }]
		} as unknown as MutationCtx;
		const id = await (
			newGp as unknown as {
				_handler: (ctx: MutationCtx, args: { participants: Id<'users'>[] }) => Promise<string>;
			}
		)._handler(ctx, { participants: ['a', 'b'] as Id<'users'>[] });
		assert.equal(inserted[0].value.order, previous.length ? 5 : 1);
		assert.deepEqual(
			inserted.map((row) => row.table),
			['grandPrix', 'races', 'grandPrixStandings', 'results', 'grandPrixStandings', 'results']
		);
		assert.equal(inserted[1].value.grandPrixId, id);
		assert.equal(inserted[3].value.raceId, 'races2');
	}
});

test('deleted GP races and standings disappear from normal queries and return on restore', async () => {
	const f = fixture();
	assert.equal((await activeGpRows(f.ctx, f.rows.races as never[])).length, 3);
	await f.del();
	assert.deepEqual(await activeGpRows(f.ctx, f.rows.races as never[]), [f.find('r3')]);
	assert.deepEqual(await activeGpRows(f.ctx, f.rows.grandPrixStandings as never[]), [f.find('s2')]);
	await f.recover();
	assert.equal((await activeGpRows(f.ctx, f.rows.races as never[])).length, 3);
});

test('new GP numbers remain reserved when the latest GP is deleted', async () => {
	let newOrder: number | undefined;
	const ctx = {
		db: {
			query(table: string) {
				return {
					withIndex: () =>
						table === 'grandPrix'
							? {
									order: () => ({
										first: async () => ({ order: 12, deletedAt: 1 }),
										filter: () => ({ take: async () => [{ _id: 'older', order: 10 }] })
									})
								}
							: { collect: async () => [] }
				};
			},
			async insert(table: string, value: { order?: number }) {
				if (table === 'grandPrix') newOrder = value.order;
				return 'created';
			}
		},
		runQuery: async () => []
	} as unknown as MutationCtx;
	await (
		newGp as unknown as {
			_handler: (ctx: MutationCtx, args: { participants: Id<'users'>[] }) => Promise<unknown>;
		}
	)._handler(ctx, { participants: [] });
	assert.equal(newOrder, 13);
});

const completion = (ctx: MutationCtx, complete: boolean, grandPrixId = 'gp') =>
	(
		setComplete as unknown as {
			_handler: (
				ctx: MutationCtx,
				args: { grandPrixId: Id<'grandPrix'>; complete: boolean }
			) => Promise<void>;
		}
	)._handler(ctx, { grandPrixId: grandPrixId as Id<'grandPrix'>, complete });

test('manual completion is reversible, idempotent and preserves race results', async () => {
	const f = fixture();
	const before = structuredClone(f.rows.results);
	await completion(f.ctx, true);
	const timestamp = f.find('gp')!.completedAt;
	assert.equal(typeof timestamp, 'number');
	await completion(f.ctx, true);
	assert.equal(f.find('gp')!.completedAt, timestamp);
	assert.deepEqual(f.rows.results, before);
	await completion(f.ctx, false);
	assert.equal(f.find('gp')!.completedAt, undefined);
	await assert.rejects(completion(f.ctx, true, 'missing'), /unavailable/);
	await f.del();
	await assert.rejects(completion(f.ctx, true), /unavailable/);
});

test('player GP wins use recorded scores and completion rather than stored first places', async () => {
	const f = fixture();
	await f.add(['b']);
	f.find('s1')!.points = 0;
	const read = (userId: string) =>
		(
			getPlayerResults as unknown as {
				_handler: (ctx: MutationCtx, args: { userId: Id<'users'> }) => Promise<{ won: boolean }[]>;
			}
		)._handler(f.ctx, { userId: userId as Id<'users'> });
	assert.equal((await read('a'))[0].won, false);
	await completion(f.ctx, true);
	assert.equal((await read('a'))[0].won, true);
	assert.equal((await read('b')).find((_, index) => index === 1)?.won, false);
	await completion(f.ctx, false);
	assert.equal((await read('a'))[0].won, false);
});

test('manual completion rejects a GP without races or participants', async () => {
	for (const empty of ['races', 'participants']) {
		const f = fixture();
		if (empty === 'races') f.rows.races = [];
		else f.find('gp')!.participants = [];
		await assert.rejects(completion(f.ctx, true), /needs races and racers/);
		assert.equal(f.writes, 0);
	}
});

const knockout = (ctx: MutationCtx, userId: string, position: number | null) =>
	(
		recordKnockoutResult as unknown as {
			_handler: (
				ctx: MutationCtx,
				args: { grandPrixId: Id<'grandPrix'>; userId: Id<'users'>; position: number | null }
			) => Promise<void>;
		}
	)._handler(ctx, {
		grandPrixId: 'gp' as Id<'grandPrix'>,
		userId: userId as Id<'users'>,
		position
	});

test('Knockout race accepts only the two tied leaders and determines the winner from both finishes', async () => {
	const f = fixture();
	await f.add(['b']);
	await assert.rejects(knockout(f.ctx, 'b', 2), /Complete the Grand Prix/);
	await completion(f.ctx, true);
	await assert.rejects(knockout(f.ctx, 'b', 2), /two racers tied for first/);
	f.rows.results.find((row) => row.userId === 'b' && row.raceId === 'r1')!.position = 1;
	f.find('s1')!.points = 999;
	const originalResults = structuredClone(f.rows.results);
	const originalStandings = structuredClone(f.rows.grandPrixStandings);
	for (const invalid of [0, 25, 1.5, NaN, Infinity])
		await assert.rejects(knockout(f.ctx, 'a', invalid), /whole number/);
	await assert.rejects(knockout(f.ctx, 'c', 1), /two racers tied for first/);
	await knockout(f.ctx, 'b', 9);
	assert.equal(f.find('gp')!.knockoutWinnerId, undefined);
	assert.deepEqual(f.find('gp')!.knockoutResults, [{ userId: 'b', position: 9 }]);
	await assert.rejects(knockout(f.ctx, 'a', 9), /different finishing positions/);
	await knockout(f.ctx, 'a', 4);
	assert.equal(f.find('gp')!.knockoutWinnerId, 'a');
	await knockout(f.ctx, 'b', 2);
	assert.equal(f.find('gp')!.knockoutWinnerId, 'b');
	await knockout(f.ctx, 'b', null);
	assert.equal(f.find('gp')!.knockoutWinnerId, undefined);
	assert.deepEqual(f.find('gp')!.knockoutResults, [{ userId: 'a', position: 4 }]);
	await knockout(f.ctx, 'b', 2);
	assert.deepEqual(f.rows.results, originalResults);
	assert.deepEqual(f.rows.grandPrixStandings, originalStandings);
	await completion(f.ctx, false);
	assert.equal(f.find('gp')!.knockoutResults, undefined);
	await completion(f.ctx, true);
	await knockout(f.ctx, 'b', 2);
	await f.add(['c']);
	assert.equal(f.find('gp')!.knockoutResults, undefined);
	await f.del();
	await assert.rejects(knockout(f.ctx, 'b', 2), /unavailable/);
});
