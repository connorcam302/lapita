import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeRivalry, parseRivalryScope, type RivalryRace } from './rivalry';
import type { Id } from '../convex/_generated/dataModel';

const row = (
	id: number,
	aPosition?: number | null,
	bPosition?: number | null,
	track = 't'
): RivalryRace => ({
	raceId: `r${id}` as Id<'races'>,
	grandPrixId: 'gp' as Id<'grandPrix'>,
	gpOrder: 1,
	raceOrder: id,
	trackId: track as Id<'tracks'>,
	aPosition,
	bPosition
});

test('paired sample excludes every invalid finish and uses Lapita points', () => {
	const invalid = [null, undefined, 0, 25, 1.5, NaN, Infinity, -1];
	const result = summarizeRivalry([
		row(1, 1, 2),
		row(2, 24, 1),
		row(3, 4, 4),
		...invalid.flatMap((v, i) => [row(i + 10, v, 1), row(i + 30, 2, v)])
	]);
	assert.equal(result.count, 3);
	assert.equal(result.aAhead, 1);
	assert.equal(result.bAhead, 1);
	assert.equal(result.ties, 1);
	assert.ok(Math.abs(result.aPercent! - 100 / 3) < 1e-10);
	assert.ok(Math.abs(result.bPercent! - 100 / 3) < 1e-10);
	assert.equal(result.aAverage, 29 / 3);
	assert.equal(result.bAverage, 7 / 3);
	assert.equal(result.aPoints, 25);
	assert.equal(result.bPoints, 36);
});

test('chronology and track grouping keep tied races flat and samples consistent', () => {
	const result = summarizeRivalry([row(3, 3, 2, 'other'), row(2, 5, 5), row(1, 1, 2)]);
	assert.deepEqual(
		result.timeline.map((r) => [r.raceNumber, r.a, r.b]),
		[
			[1, 1, 0],
			[2, 1, 0],
			[3, 1, 1]
		]
	);
	assert.equal(result.tracks[0].count, 2);
	assert.equal(result.tracks[0].aAhead, 1);
	assert.equal(result.tracks[0].ties, 1);
	assert.equal(
		result.tracks.reduce((sum, t) => sum + t.count, 0),
		result.count
	);
	const laterGp = { ...row(0, 1, 3), gpOrder: 2 };
	assert.equal(summarizeRivalry([laterGp, row(9, 2, 3)]).races.at(-1)?.gpOrder, 2);
});

test('swapping rivals reverses all directional metrics', () => {
	const races = [row(1, 1, 2), row(2, 4, 5), row(3, 3, 3)];
	const a = summarizeRivalry(races);
	const b = summarizeRivalry(
		races.map((r) => ({ ...r, aPosition: r.bPosition, bPosition: r.aPosition }))
	);
	assert.equal(a.aAhead, b.bAhead);
	assert.equal(a.aPoints, b.bPoints);
	assert.equal(a.aAverage, b.bAverage);
	assert.equal(a.aPercent, b.bPercent);
});

test('empty and all-tie samples have explicit denominators', () => {
	const empty = summarizeRivalry([]);
	assert.equal(empty.aPercent, null);
	assert.equal(empty.aAverage, null);
	assert.equal(empty.aPoints, 0);
	assert.deepEqual(empty.timeline, []);
	const ties = summarizeRivalry([row(1, 2, 2)]);
	assert.equal(ties.aPercent, 0);
	assert.equal(ties.bPercent, 0);
	assert.equal(ties.ties, 1);
});

test('scope parsing rejects malformed URL values', () => {
	for (const value of [null, '', '0', '100', '-5', '10.5'])
		assert.equal(parseRivalryScope(value), 'all');
	for (const value of ['all', '5', '10', '20']) assert.equal(parseRivalryScope(value), value);
});
