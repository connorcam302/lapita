import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MutationCtx } from '../src/convex/_generated/server';
import { setEra } from '../src/convex/gps';

type Args = { from: number; to: number; era: string };
function fixture() {
	const gps = [3, 4, 5, 6, 7, 8, 9].map((order) => ({
		_id: `gp${order}`,
		order,
		era: 'Old arc' as string | undefined,
		deletedAt: order === 6 ? 1 : undefined
	}));
	let writes = 0;
	const ctx = {
		db: {
			query: () => ({
				withIndex: (_name: string, callback: (q: unknown) => unknown) => {
					let lower = -Infinity,
						upper = Infinity;
					const range = {
						gte: (_field: string, value: number) => {
							lower = value;
							return range;
						},
						lte: (_field: string, value: number) => {
							upper = value;
							return range;
						}
					};
					callback(range);
					return {
						collect: async () => gps.filter((gp) => gp.order >= lower && gp.order <= upper)
					};
				}
			}),
			patch: async (id: string, patch: { era?: string }) => {
				writes++;
				Object.assign(
					gps.find((gp) => gp._id === id)!,
					patch
				);
			}
		}
	} as unknown as MutationCtx;
	return {
		gps,
		get writes() {
			return writes;
		},
		save: (args: Args) =>
			(
				setEra as unknown as { _handler: (ctx: MutationCtx, args: Args) => Promise<number> }
			)._handler(ctx, args)
	};
}

test('tags an inclusive GP range, trims its name, and preserves deleted and outside GPs', async () => {
	const f = fixture();
	assert.equal(await f.save({ from: 4, to: 8, era: '  Dixie Dean Arc  ' }), 4);
	assert.deepEqual(
		f.gps.map((gp) => gp.era),
		[
			'Old arc',
			'Dixie Dean Arc',
			'Dixie Dean Arc',
			'Old arc',
			'Dixie Dean Arc',
			'Dixie Dean Arc',
			'Old arc'
		]
	);
});

test('supports a single GP, replacement, and clearing without removing other data', async () => {
	const f = fixture();
	const before = structuredClone(f.gps);
	assert.equal(await f.save({ from: 4, to: 4, era: 'New arc' }), 1);
	assert.equal(f.gps[1].era, 'New arc');
	await f.save({ from: 4, to: 4, era: '   ' });
	assert.equal(f.gps[1].era, undefined);
	assert.deepEqual(
		f.gps.map(({ _id, order, deletedAt }) => ({ _id, order, deletedAt })),
		before.map(({ _id, order, deletedAt }) => ({ _id, order, deletedAt }))
	);
});

test('rejects invalid ranges, long names, empty ranges and deleted-only ranges before writing', async () => {
	for (const args of [
		{ from: 0, to: 4, era: 'Arc' },
		{ from: 8, to: 4, era: 'Arc' },
		{ from: 4.5, to: 8, era: 'Arc' },
		{ from: 4, to: Infinity, era: 'Arc' },
		{ from: 4, to: 8, era: 'a'.repeat(81) },
		{ from: 10, to: 12, era: 'Arc' },
		{ from: 6, to: 6, era: 'Arc' }
	]) {
		const f = fixture();
		await assert.rejects(f.save(args));
		assert.equal(f.writes, 0);
	}
});
