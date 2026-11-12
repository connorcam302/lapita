import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MutationCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';
import { addRacers, remove, newGp } from '../src/convex/gps';

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
					return { collect: async () => rows[table].filter((row) => row[field] === value) };
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
	return {
		rows,
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

test('delete cascades to all GP results, races and standings, leaving other data intact', async () => {
	const f = fixture();
	await f.add(['b']);
	await f.del();
	assert.equal(f.find('gp'), undefined);
	assert.deepEqual(
		f.rows.races.map((row) => row._id),
		['r3']
	);
	assert.deepEqual(
		f.rows.results.map((row) => row._id),
		['outside']
	);
	assert.deepEqual(
		f.rows.grandPrixStandings.map((row) => row._id),
		['s2']
	);
	assert.equal(f.rows.users.length, 3);
	assert.ok(f.find('other'));
	await f.del();
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
								? { order: () => ({ take: async () => previous }) }
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
