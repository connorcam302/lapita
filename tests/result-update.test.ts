import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MutationCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';
import { update } from '../src/convex/results';
import { isValidFinishPosition } from '../src/lib/grand-prix';

type Row = { _id: string; [key: string]: unknown };

function fixture() {
	const rows: Record<string, Row[]> = {
		grandPrix: [{ _id: 'gp', participants: ['player', 'other'] }],
		races: [
			{ _id: 'race', grandPrixId: 'gp' },
			{ _id: 'race2', grandPrixId: 'gp' },
			{ _id: 'outside', grandPrixId: 'other-gp' }
		],
		karts: [{ _id: 'kart' }],
		characters: [{ _id: 'character' }],
		results: [
			{ _id: 'result', raceId: 'race', userId: 'player', position: 1 },
			{ _id: 'result2', raceId: 'race2', userId: 'player', position: 2 },
			{ _id: 'outside-result', raceId: 'outside', userId: 'player', position: 1 },
			{ _id: 'other-result', raceId: 'race', userId: 'other', position: 3 }
		],
		grandPrixStandings: [
			{ _id: 'standing', grandPrixId: 'gp', userId: 'player', points: 27 },
			{ _id: 'other-standing', grandPrixId: 'gp', userId: 'other', points: 10 }
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
			const filters: [string, unknown][] = [];
			const builder = {
				eq(field: string, value: unknown) {
					filters.push([field, value]);
					return builder;
				}
			};
			const collect = async () =>
				rows[table].filter((row) => filters.every(([field, value]) => row[field] === value));
			return {
				withIndex(_name: string, callback: (q: typeof builder) => unknown) {
					callback(builder);
					return {
						collect,
						async unique() {
							const matches = await collect();
							assert.ok(matches.length <= 1);
							return matches[0] ?? null;
						}
					};
				}
			};
		},
		async patch(id: string, value: Partial<Row>) {
			writes++;
			Object.assign(find(id)!, value);
		}
	};
	const args = {
		grandPrixId: 'gp' as Id<'grandPrix'>,
		raceId: 'race' as Id<'races'>,
		userId: 'player' as Id<'users'>,
		kartId: 'kart' as Id<'karts'>,
		characterId: 'character' as Id<'characters'>,
		position: 3
	};
	return {
		rows,
		find,
		args,
		get writes() {
			return writes;
		},
		save: (changes: Partial<typeof args> = {}) =>
			(
				update as unknown as {
					_handler: (ctx: MutationCtx, input: typeof args) => Promise<{ status: string }>;
				}
			)._handler({ db } as unknown as MutationCtx, { ...args, ...changes })
	};
}

test('reject invalid finishes before any writes, then allow a correction', async () => {
	for (const position of [0, -1, 25, 100, 1.5, NaN, Infinity, -Infinity]) {
		const f = fixture();
		await assert.rejects(f.save({ position }), /whole number from 1 to 24/);
		assert.equal(f.writes, 0);
		assert.equal(f.find('result')!.position, 1);
		assert.equal(f.find('standing')!.points, 27);
		await f.save({ position: 2 });
		assert.equal(f.find('standing')!.points, 24);
	}
});

test('valid edits and retries use source results, keeping other GPs and racers out', async () => {
	const f = fixture();
	assert.deepEqual(await f.save(), { status: 'Ok' });
	assert.equal(f.find('standing')!.points, 22);
	await f.save();
	assert.equal(f.find('standing')!.points, 22);
	await f.save({ position: 24 });
	assert.equal(f.find('standing')!.points, 13);
	assert.equal(f.find('other-standing')!.points, 10);
	assert.equal(f.find('outside-result')!.position, 1);
	assert.equal(f.find('result')!.kartId, 'kart');
	assert.equal(f.find('result')!.characterId, 'character');
});

test('edits to different races retain each saved finish and tolerate unrecorded races', async () => {
	const f = fixture();
	await f.save({ position: 24 });
	await f.save({ raceId: 'race2' as Id<'races'>, position: 1 });
	assert.equal(f.find('standing')!.points, 16);
	f.rows.results = f.rows.results.filter((row) => row._id !== 'result2');
	await f.save({ position: 2 });
	assert.equal(f.find('standing')!.points, 12);
});

test('corrections recover corrupt totals and ignore other invalid historical finishes', async () => {
	for (const points of [NaN, Infinity, -Infinity, -10, 999]) {
		for (const oldPosition of [undefined, null, 0, -1, 25, 1.5, NaN, Infinity, 1]) {
			const f = fixture();
			f.find('standing')!.points = points;
			f.find('result')!.position = oldPosition;
			await f.save();
			assert.equal(f.find('standing')!.points, 22);
		}
	}
	for (const position of [undefined, null, 0, -1, 25, 1.5, NaN, Infinity]) {
		const f = fixture();
		f.find('result2')!.position = position;
		await f.save();
		assert.equal(f.find('standing')!.points, 10);
	}
});

test('validate race ownership, participation, references and required records before writes', async () => {
	for (const scenario of ['gp', 'race', 'participant', 'kart', 'character', 'result', 'standing']) {
		const f = fixture();
		if (scenario === 'race') f.find('race')!.grandPrixId = 'other-gp';
		else if (scenario === 'participant') f.find('gp')!.participants = ['other'];
		else if (scenario === 'result')
			f.rows.results = f.rows.results.filter((row) => row._id !== 'result');
		else if (scenario === 'standing') f.rows.grandPrixStandings = [];
		else f.find(scenario)!._id = 'deleted';
		await assert.rejects(f.save());
		assert.equal(f.writes, 0, scenario);
	}
});

test('all 24 valid positions retain the existing points system', async () => {
	const points = [15, 12, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1];
	for (let position = 1; position <= 24; position++) {
		const f = fixture();
		await f.save({ position });
		assert.equal(f.find('standing')!.points, points[position - 1] + 12);
	}
	for (const input of ['', ' ', 'abc', null, undefined, '1', {}, NaN, Infinity]) {
		assert.equal(isValidFinishPosition(input), false);
	}
});

test('deleted GPs reject result edits before writes', async () => {
	const f = fixture();
	f.find('gp')!.deletedAt = 1;
	await assert.rejects(f.save());
	assert.equal(f.writes, 0);
});
