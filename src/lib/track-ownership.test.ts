import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownershipShares, ownershipGap, ownershipSummary, trackOwnership } from './track-ownership';
import { summarizeTrackOverview } from './track-stats';
import type { Id } from '../convex/_generated/dataModel';
import { getStats } from '../convex/races';
import type { QueryCtx } from '../convex/_generated/server';

const trackId = 'track' as Id<'tracks'>;
const users = ['A', 'B', 'C'].map((name) => ({ _id: name as Id<'users'>, name }));
const tracks = [{ _id: trackId, name: 'Track', img: 'track' }];
function track(players: [string, number, number][]) {
	return {
		trackId,
		trackName: 'Track',
		trackImg: 'track',
		counts: 10,
		averageParticipants: 3,
		userAverages: players.map(([userId, average, count]) => ({
			userId: userId as Id<'users'>,
			userName: userId,
			average,
			count
		}))
	};
}

test('threshold is inclusive, per player, and applied before ranking', () => {
	const [row] = trackOwnership([
		track([
			['A', 1, 4],
			['B', 2, 5],
			['C', 3, 10]
		])
	]);
	assert.equal(row.status, 'outright');
	assert.deepEqual(
		row.leaders.map((p) => p.userId),
		['B']
	);
	assert.equal(row.gap, 1);
	assert.equal(row.belowMinimum[0].userId, 'A');
	assert.equal(row.resultCount, 19);
});

test('shared leads use unrounded averages, independently of sample count and input order', () => {
	const [shared] = trackOwnership([
		track([
			['C', 4, 10],
			['B', 2, 7],
			['A', 2, 5]
		])
	]);
	assert.equal(shared.status, 'shared');
	assert.deepEqual(
		shared.leaders.map((p) => p.userId),
		['A', 'B']
	);
	assert.equal(shared.gap, 0);
	const [close] = trackOwnership([
		track([
			['B', 2.004, 5],
			['A', 2.001, 5]
		])
	]);
	assert.equal(close.status, 'outright');
	assert.equal(close.leaders.length, 1);
	assert.equal(ownershipGap(close.gap!), '<0.01');
	assert.equal(ownershipGap(0), '0.00');
});

test('unraced, low-sample and sole eligible tracks remain distinct and uncounted as competitive leads', () => {
	const rows = trackOwnership([
		track([]),
		track([['A', 1, 2]]),
		track([
			['A', 1, 5],
			['B', 2, 4]
		])
	]);
	assert.deepEqual(
		rows.map((row) => row.status),
		['unraced', 'low-sample', 'solo']
	);
	assert.deepEqual(
		rows.map((row) => row.gap),
		[null, null, null]
	);
	assert.deepEqual(ownershipSummary(rows), { outright: 0, shared: 0, solo: 1 });
	assert.equal(rows[1].belowMinimum.length, 1);
});

test('overall and player totals count a shared track once, without fractional credit or reranking', () => {
	const rows = trackOwnership([
		track([
			['A', 1, 5],
			['B', 2, 5]
		]),
		track([
			['A', 2, 5],
			['B', 2, 5],
			['C', 3, 5]
		])
	]);
	assert.deepEqual(ownershipSummary(rows), { outright: 1, shared: 1, solo: 0 });
	assert.deepEqual(ownershipSummary(rows, 'A'), { outright: 1, shared: 1, solo: 0 });
	assert.deepEqual(ownershipSummary(rows, 'B'), { outright: 0, shared: 1, solo: 0 });
	assert.deepEqual(ownershipSummary(rows, 'C'), { outright: 0, shared: 0, solo: 0 });
	assert.equal(rows[1].gap, 0);
});

test('shared aggregation counts only valid finishes on the end track, including partial races', () => {
	const overview = summarizeTrackOverview(tracks, users, [
		{
			trackEndId: trackId,
			results: [1, 24, 0, 25, 1.5, null, undefined, NaN].map((position) => ({
				userId: users[0]._id,
				position
			}))
		},
		{ trackEndId: 'other' as Id<'tracks'>, results: [{ userId: users[0]._id, position: 1 }] },
		{ trackEndId: trackId, results: [] }
	]);
	assert.equal(overview[0].counts, 2);
	assert.equal(overview[0].userAverages[0].count, 2);
	assert.equal(overview[0].userAverages[0].average, 12.5);
	assert.equal(trackOwnership(overview)[0].status, 'low-sample');
});

test('getStats excludes deleted GPs before computing ownership and counts transitions by end track', async () => {
	const races = [
		{ _id: 'r1', grandPrixId: 'active', trackStartId: 'other', trackEndId: trackId },
		{ _id: 'r2', grandPrixId: 'deleted', trackStartId: trackId, trackEndId: trackId }
	];
	const data: Record<string, unknown[]> = { races, tracks, users };
	const db = {
		get: async (id: string) => ({ _id: id, ...(id === 'deleted' ? { deletedAt: 0 } : {}) }),
		query(table: string) {
			let raceId = '';
			return {
				withIndex(_name: string, callback?: (q: unknown) => unknown) {
					callback?.({
						eq: (_field: string, value: string) => {
							raceId = value;
						}
					});
					return this;
				},
				order() {
					return this;
				},
				collect: async () =>
					table === 'results'
						? [{ userId: users[raceId === 'r1' ? 0 : 1]._id, position: 1 }]
						: data[table]
			};
		}
	};
	// Convex exposes this runtime hook for exercising registered queries in unit tests.
	const query = getStats as unknown as {
		_handler(
			ctx: QueryCtx,
			args: Record<string, never>
		): Promise<Parameters<typeof trackOwnership>[0]>;
	};
	const overview = await query._handler({ db } as unknown as QueryCtx, {});
	const [row] = trackOwnership(overview);
	assert.equal(row.counts, 1);
	assert.equal(row.resultCount, 1);
	assert.equal(row.belowMinimum[0].userId, 'A');
	assert.equal(row.status, 'low-sample');
});

test('ownership bar gives each track equal weight and splits shared ownership evenly', () => {
	const rows = trackOwnership([
		track([
			['A', 1, 5],
			['B', 2, 5]
		]),
		track([
			['A', 2, 5],
			['B', 2, 5]
		]),
		track([
			['A', 2, 5],
			['B', 2, 5],
			['C', 2, 5]
		]),
		track([['A', 1, 4]]),
		track([]),
		track([['B', 1, 5]])
	]);
	const shares = ownershipShares(rows);
	assert.equal(shares.total, 6);
	assert.equal(shares.unclaimed, 3);
	assert.ok(Math.abs(shares.players[0].weight - (1 + 1 / 2 + 1 / 3)) < 1e-10);
	assert.equal(shares.players[0].tracks.length, 3);
	assert.equal(shares.players[0].tracks.filter((t) => t.shared).length, 2);
	assert.ok(
		Math.abs(shares.players.reduce((sum, p) => sum + p.weight, shares.unclaimed) - shares.total) <
			1e-10
	);
	assert.deepEqual(ownershipShares([]), { players: [], total: 0, unclaimed: 0 });
});
