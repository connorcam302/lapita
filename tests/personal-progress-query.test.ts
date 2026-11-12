import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personalProgress } from '../src/convex/results';
import type { QueryCtx } from '../src/convex/_generated/server';

type Gp = {
	_id: string;
	_creationTime: number;
	order: number;
	participants: string[];
	deletedAt?: number;
};
function fixture(gps: Gp[], positions: Record<string, number | null | (number | null)[]>) {
	const reads: string[] = [];
	const ctx = {
		db: {
			query: (table: string) => ({
				withIndex: (index: string, callback: (range: unknown) => unknown) => {
					const values: Record<string, unknown> = {};
					const range = {
						eq: (key: string, value: unknown) => {
							values[key] = value;
							return range;
						},
						lte: (key: string, value: unknown) => {
							values[key] = value;
							return range;
						}
					};
					callback(range);
					if (table === 'grandPrix')
						return {
							order: () => ({
								async *[Symbol.asyncIterator]() {
									for (const gp of gps) if (gp.order <= Number(values.order ?? Infinity)) yield gp;
								}
							})
						};
					if (table === 'races') {
						reads.push(String(values.grandPrixId));
						return {
							collect: async () => [
								{ _id: values.grandPrixId, trackStartId: 'start', trackEndId: 'end' }
							]
						};
					}
					assert.equal(index, 'raceIdAndUserId');
					assert.equal(values.userId, 'player');
					return {
						collect: async () => {
							const position = positions[String(values.raceId)];
							return (Array.isArray(position) ? position : [position]).map((position) => ({
								position
							}));
						}
					};
				}
			})
		}
	} as unknown as QueryCtx;
	return {
		reads,
		run: (through?: number) =>
			(
				personalProgress as unknown as {
					_handler: (
						ctx: QueryCtx,
						args: { userId: string; size: number; through?: number }
					) => Promise<{
						gps: { order: number; finishes: { trackEndId: string }[] }[];
						limited: boolean;
					}>;
				}
			)._handler(ctx, { userId: 'player', size: 5, through })
	};
}
const gp = (order: number): Gp => ({
	_id: `gp${order}`,
	order,
	_creationTime: order,
	participants: ['player']
});

test('excludes deleted, absent and invalid history; uses end track and stops at two windows', async () => {
	const gps = Array.from({ length: 20 }, (_, i) => gp(20 - i));
	gps[0].deletedAt = 1;
	gps[1].participants = [];
	const positions = Object.fromEntries(gps.map((g) => [g._id, g.order === 18 ? 0 : 2]));
	const f = fixture(gps, positions);
	const result = await f.run();
	assert.deepEqual(
		result.gps.map((g) => g.order),
		[17, 16, 15, 14, 13, 12, 11, 10, 9, 8]
	);
	assert.ok(result.gps.every((g) => g.finishes[0].trackEndId === 'end'));
	assert.equal(f.reads.length, 11);
	assert.equal(result.limited, false);
	assert.deepEqual(
		(await f.run(5)).gps.map((g) => g.order),
		[5, 4, 3, 2, 1]
	);
	await assert.rejects(() => f.run(1.5));
});

test('bounds sparse attendance scans and reports truncation', async () => {
	const gps = Array.from({ length: 600 }, (_, i) => ({ ...gp(600 - i), participants: [] }));
	const result = await fixture(gps, {}).run();
	assert.equal(result.limited, true);
	assert.deepEqual(result.gps, []);
});

test('legacy repeated result rows follow the profile recorded-finish definition without failing', async () => {
	const result = await fixture([gp(1)], { gp1: [2, 4, null, 25] }).run();
	assert.equal(result.gps.length, 1);
	assert.equal(result.gps[0].finishes.length, 2);
});
