import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	buildPersonalProgress,
	parseProgressPeriod,
	summarizeFinishes,
	type ProgressGp
} from './personal-progress';

function gp(order: number, finishes = [{ trackEndId: 'a', position: order }]): ProgressGp {
	return { id: `gp${order}`, order, createdAt: order * 1000, finishes };
}

test('period parsing validates shareable parameters without accepting nonfinite or fractional values', () => {
	assert.deepEqual(parseProgressPeriod(new URLSearchParams()), { size: 10, through: undefined });
	assert.deepEqual(parseProgressPeriod(new URLSearchParams('progressSize=5&progressThrough=42')), {
		size: 5,
		through: 42
	});
	for (const value of ['Infinity', '-1', '0', '1.5', 'no']) {
		assert.deepEqual(
			parseProgressPeriod(new URLSearchParams(`progressSize=${value}&progressThrough=${value}`)),
			{ size: 10, through: undefined }
		);
	}
});

test('windows use GP order, not input/result timestamps, and exclude GPs without valid finishes', () => {
	const progress = buildPersonalProgress(
		[gp(2), gp(9, [{ trackEndId: 'a', position: 0 }]), gp(1), gp(6), gp(3), gp(5), gp(4)],
		5
	);
	assert.deepEqual(
		progress.recent.gps.map((g) => g.order),
		[6, 5, 4, 3, 2]
	);
	assert.deepEqual(
		progress.previous.gps.map((g) => g.order),
		[1]
	);
	assert.deepEqual(
		progress.trend.map((g) => g.order),
		[1, 2, 3, 4, 5, 6]
	);
	assert.equal(progress.recent.average, 4);
	assert.equal(progress.previous.average, 1);
	assert.equal(progress.shared.delta, 3);
});

test('empty, short and disjoint histories produce unavailable comparisons, not zero averages', () => {
	assert.equal(buildPersonalProgress([], 10).recent.average, null);
	assert.equal(buildPersonalProgress([gp(1)], 10).shared.delta, null);
	const progress = buildPersonalProgress(
		Array.from({ length: 6 }, (_, i) => gp(i + 1, [{ trackEndId: i ? 'a' : 'b', position: 2 }])),
		5
	);
	assert.equal(progress.shared.count, 0);
	assert.equal(progress.shared.delta, null);
	assert.equal(progress.tracks.length, 2);
	assert.ok(progress.tracks.every((t) => t.delta === null));
});

test('valid individual finishes drive wins and authoritative points even in partial races', () => {
	const stats = summarizeFinishes(
		[0, 1, 2, 4, 24, 25, 2.5, NaN].map((position) => ({ trackEndId: 'a', position }))
	);
	assert.equal(stats.count, 4);
	assert.equal(stats.average, 7.75);
	assert.equal(stats.points, (15 + 12 + 9 + 1) / 4);
	assert.equal(stats.winRate, 0.25);
});

test('shared tracks get equal weight so changing track frequency cannot manufacture improvement', () => {
	const finishes = (a: number, b: number) => [
		...Array.from({ length: a }, () => ({ trackEndId: 'a', position: 2 })),
		...Array.from({ length: b }, () => ({ trackEndId: 'b', position: 10 }))
	];
	const progress = buildPersonalProgress(
		Array.from({ length: 10 }, (_, i) => gp(i + 1, i < 5 ? finishes(1, 9) : finishes(9, 1))),
		5
	);
	assert.ok(progress.recent.average! < progress.previous.average!);
	assert.equal(progress.shared.recent, 6);
	assert.equal(progress.shared.previous, 6);
	assert.equal(progress.shared.delta, 0);
	assert.equal(progress.shared.recentCount, 50);
	assert.equal(progress.shared.previousCount, 50);
});

test('actual track improvements retain unrounded deltas and unequal samples', () => {
	const progress = buildPersonalProgress(
		Array.from({ length: 10 }, (_, i) =>
			gp(i + 1, [{ trackEndId: 'end', position: i < 5 ? 4 : 2 }])
		),
		5
	);
	assert.equal(progress.shared.delta, -2);
	assert.equal(progress.tracks[0].delta, -2);
	assert.equal(progress.tracks[0].recent.count, 5);
});

test('one-GP periods support two-GP histories without overlap', () => {
	const progress = buildPersonalProgress([gp(1), gp(2)], 1);
	assert.equal(progress.recent.gps.length, 1);
	assert.equal(progress.previous.gps.length, 1);
	assert.equal(progress.shared.delta, 1);
	assert.deepEqual(parseProgressPeriod(new URLSearchParams('progressSize=1')), {
		size: 1,
		through: undefined
	});
});
