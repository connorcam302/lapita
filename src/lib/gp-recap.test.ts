import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRecap, recapSeries, recapGapSeries, recapDriversOfTheDay } from './gp-recap';

const race = (order: number, positions: Record<string, number | null>) => ({
	_id: `r${order}`,
	order,
	results: Object.entries(positions).map(([userId, position]) => ({ userId, position }))
});

test('scores every place with Lapita scoring, ignores outsiders, and sorts race order', () => {
	const recap = buildRecap(
		['a', 'b', 'c'],
		[race(1, { a: 24, b: 4, c: 6, outsider: 1 }), race(0, { a: 1, b: 2, c: 3 })]
	);
	assert.equal(recap.complete, true);
	assert.deepEqual(
		recap.standings.map(({ userId, points, wins }) => ({ userId, points, wins })),
		[
			{ userId: 'b', points: 21, wins: 0 },
			{ userId: 'c', points: 18, wins: 0 },
			{ userId: 'a', points: 16, wins: 1 }
		]
	);
	assert.deepEqual(
		recap.rows.map((r) => r.order),
		[0, 1]
	);
	assert.equal(recap.margin, 3);
	assert.deepEqual(recapSeries(recap, 'a'), [0, 15, 16]);
});

test('ties share competition ranks and every tied podium place is included', () => {
	const recap = buildRecap(['a', 'b', 'c', 'd', 'e'], [race(0, { a: 1, b: 1, c: 2, d: 2, e: 3 })]);
	assert.deepEqual(
		recap.standings.map((s) => s.rank),
		[1, 1, 3, 3, 5]
	);
	assert.equal(recap.margin, 0);
	assert.equal(recap.podium.length, 4);
	assert.deepEqual(
		recap.standings.map((s) => s.wins),
		[1, 1, 0, 0, 0]
	);
});

test('lead-set transitions include entering and leaving ties; opening lead excluded', () => {
	const recap = buildRecap(
		['a', 'b'],
		[race(0, { a: 1, b: 2 }), race(1, { a: 2, b: 1 }), race(2, { a: 3, b: 1 })]
	);
	assert.deepEqual(recap.leadChanges, [
		{ afterRace: 2, leaderIds: ['a', 'b'] },
		{ afterRace: 3, leaderIds: ['b'] }
	]);
	assert.deepEqual(recap.comebacks, [{ userId: 'b', worstRank: 2, finalRank: 1, gain: 1 }]);
});

test('biggest comeback retains all ties and excludes the starting grid', () => {
	const recap = buildRecap(
		['a', 'b', 'c'],
		[race(0, { a: 1, b: 2, c: 2 }), race(1, { a: 24, b: 1, c: 1 })]
	);
	assert.deepEqual(
		recap.comebacks.map((r) => [r.userId, r.gain]),
		[
			['b', 1],
			['c', 1]
		]
	);
	const stable = buildRecap(['a', 'b'], [race(0, { a: 1, b: 2 })]);
	assert.deepEqual(stable.comebacks, []);
	assert.deepEqual(stable.leadChanges, []);
});

test('manual completion with gaps counts only recorded scores and withholds events', () => {
	const races = [
		race(0, { a: 1, b: null }),
		race(1, { a: 0, b: 1 }),
		race(2, { a: 2.5, b: 25 }),
		race(3, { a: 2, b: 3 })
	];
	assert.equal(buildRecap(['a', 'b'], races).complete, false);
	const recap = buildRecap(['a', 'b'], races, 123);
	assert.equal(recap.complete, true);
	assert.equal(recap.fullHistory, false);
	assert.equal(recap.missing, 4);
	assert.deepEqual(
		recap.standings.map((r) => [r.userId, r.points, r.recorded, r.wins]),
		[
			['a', 27, 2, 1],
			['b', 25, 2, 1]
		]
	);
	assert.deepEqual(recap.comebacks, []);
	assert.deepEqual(recap.leadChanges, []);
	assert.deepEqual(recapSeries(recap, 'a'), [0, 15, null, null, null]);
	assert.deepEqual(recapSeries(recap, 'b'), [0, null, null, null, null]);
});

test('empty, solo, no recorded finishes, and deleted participant results do not invent events', () => {
	assert.equal(buildRecap([], [], 1).complete, false);
	assert.equal(buildRecap(['a'], [], 1).complete, false);
	const solo = buildRecap(['a'], [race(0, { a: 4, removed: 1 })]);
	assert.equal(solo.margin, null);
	assert.equal(solo.standings[0].wins, 0);
	const empty = buildRecap(['a', 'b'], [race(0, {})], 1);
	assert.equal(empty.margin, 0);
	assert.equal(empty.fullHistory, false);
	assert.deepEqual(
		empty.standings.map((s) => [s.rank, s.points, s.wins]),
		[
			[1, 0, 0],
			[1, 0, 0]
		]
	);
});

test('all 24 finishes match the scoring authority, not the standard Mario Kart scoring', () => {
	const positions = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`p${i + 1}`, i + 1]));
	const recap = buildRecap(Object.keys(positions), [race(0, positions)]);
	assert.deepEqual(
		recap.standings.map((s) => s.points),
		[15, 12, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1]
	);
});

test('gap chart keeps shared leaders at zero and shows changes in the leader', () => {
	const recap = buildRecap(
		['a', 'b'],
		[race(0, { a: 1, b: 2 }), race(1, { a: 2, b: 1 }), race(2, { a: 3, b: 1 })]
	);
	assert.deepEqual(recapGapSeries(recap, 'a'), [0, 0, 0, 5]);
	assert.deepEqual(recapGapSeries(recap, 'b'), [0, 3, 0, 0]);
});

test('gap chart stops every racer before any missing finish makes the leader unknown', () => {
	const recap = buildRecap(
		['a', 'b'],
		[race(0, { a: 1, b: 2 }), race(1, { a: 1, b: null }), race(2, { a: 1, b: 2 })],
		1
	);
	assert.deepEqual(recapGapSeries(recap, 'a'), [0, 0, null, null]);
	assert.deepEqual(recapGapSeries(recap, 'b'), [0, 3, null, null]);
});

test('Driver of the Day combines points and wins above expectation, allowing wins to change the winner', () => {
	const recap = buildRecap(['a', 'b'], [race(0, { a: 1, b: 2 }), race(1, { a: 1, b: 3 })]);
	const comparisons = [
		{ userId: 'a', difference: 4, expectedWins: 0.5 },
		{ userId: 'b', difference: 6, expectedWins: 1.5 }
	];
	const winners = recapDriversOfTheDay(recap, comparisons)!;
	assert.equal(winners.length, 1);
	assert.equal(winners[0].userId, 'a');
	assert.equal(winners[0].score, 8.5);
	assert.equal(winners[0].winDifference, 1.5);
	assert.equal(winners[0].averageFinish, 1);
	assert.deepEqual(
		recapDriversOfTheDay(
			recap,
			comparisons.map((row) => ({ ...row, difference: -20 }))
		),
		[]
	);
	assert.equal(recapDriversOfTheDay(recap, comparisons.slice(1)), null);
	for (const expectedWins of [null, NaN, -1, 3]) {
		assert.equal(
			recapDriversOfTheDay(
				recap,
				comparisons.map((row) => ({ ...row, expectedWins }))
			),
			null
		);
	}
	assert.equal(
		recapDriversOfTheDay(buildRecap(['a', 'b'], [race(0, { a: 1 })], 1), comparisons),
		null
	);
	assert.equal(recapDriversOfTheDay(buildRecap(['a'], [race(0, { a: 1 })]), comparisons), null);
});

test('equal combined award scores share the award even with different points and win gaps', () => {
	const recap = buildRecap(['a', 'b'], [race(0, { a: 1, b: 2 })]);
	assert.deepEqual(
		recapDriversOfTheDay(recap, [
			{ userId: 'a', difference: 2, expectedWins: 0.5 },
			{ userId: 'b', difference: 5, expectedWins: 0.5 }
		])!.map(({ userId, score }) => [userId, score]),
		[
			['a', 3.5],
			['b', 3.5]
		]
	);
});
