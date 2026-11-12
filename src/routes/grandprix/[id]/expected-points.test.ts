import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateExpectedPoints, calculatePointsComparison } from './expected-points';

const participants = ['a', 'b', 'c', 'd'];
const stats = [
	{
		trackId: 'one',
		chances: [60, 20, 15, 5].map((chance, i) => ({ user: { userId: participants[i] }, chance }))
	},
	{
		trackId: 'two',
		chances: [5, 15, 20, 60].map((chance, i) => ({ user: { userId: participants[i] }, chance }))
	}
];
const race = (trackEndId: string, positions: (number | null | undefined)[] = []) => ({
	trackEndId,
	results: positions.map((position, i) => ({ userId: participants[i], position }))
});
const project = (races: ReturnType<typeof race>[], chances = stats) =>
	Object.fromEntries(calculateExpectedPoints(participants, races, chances));

test('each remaining race uses its own probability ranking and the app scoring system', () => {
	assert.deepEqual(project([race('one'), race('two')]), { a: 24, b: 22, c: 22, d: 24 });
});

test('recorded results replace predictions, reserve places, and react to edits', () => {
	assert.deepEqual(project([race('one', [null, 1])]), { a: 12, b: 15, c: 10, d: 9 });
	assert.deepEqual(project([race('one', [null, 2])]), { a: 15, b: 12, c: 10, d: 9 });
	assert.deepEqual(project([race('one', [4, 3, 2, 1]), race('two')]), {
		a: 18,
		b: 20,
		c: 24,
		d: 30
	});
});

test('completed GPs equal actual scores even without probability data', () => {
	assert.deepEqual(project([race('one', [24, 12, 6, 1])], []), { a: 1, b: 6, c: 8, d: 15 });
	assert.deepEqual(project([], []), { a: 0, b: 0, c: 0, d: 0 });
});

test('exact ties use stable racer IDs without depending on participant order', () => {
	const tied = [
		{ trackId: 'one', chances: participants.map((userId) => ({ user: { userId }, chance: 25 })) }
	];
	assert.deepEqual(project([race('one')], tied), { a: 15, b: 12, c: 10, d: 9 });
	assert.deepEqual(
		Object.fromEntries(calculateExpectedPoints([...participants].reverse(), [race('one')], tied)),
		{ a: 15, b: 12, c: 10, d: 9 }
	);
});

test('missing history does not invent a forecast; invalid finishes remain unrecorded', () => {
	assert.deepEqual(project([race('one', [1])], []), { a: 15, b: null, c: null, d: null });
	assert.deepEqual(project([race('one', [0, 25, 1.5, null])]), { a: 15, b: 12, c: 10, d: 9 });
	assert.deepEqual(
		project([race('one')], [{ trackId: 'one', chances: [{ user: { userId: 'a' }, chance: NaN }] }]),
		{ a: null, b: null, c: null, d: null }
	);
});

test('comparison keeps predictions independent of actual results and ignores unplayed races', () => {
	const comparison = calculatePointsComparison(
		participants,
		[race('one', [4, 1, 2, 3]), race('two')],
		stats
	);
	assert.deepEqual(comparison, [
		{ userId: 'a', recordedRaces: 1, actual: 9, expected: 15, difference: -6 },
		{ userId: 'b', recordedRaces: 1, actual: 15, expected: 12, difference: 3 },
		{ userId: 'c', recordedRaces: 1, actual: 12, expected: 10, difference: 2 },
		{ userId: 'd', recordedRaces: 1, actual: 10, expected: 9, difference: 1 }
	]);
});

test("comparison uses each player's recorded races, excludes invalid finishes, and updates after edits", () => {
	const races = [race('one', [4, 1, null, 0]), race('two', [1, undefined, 25, 1.5])];
	assert.deepEqual(calculatePointsComparison(participants, races, stats)[0], {
		userId: 'a',
		recordedRaces: 2,
		actual: 24,
		expected: 24,
		difference: 0
	});
	assert.deepEqual(calculatePointsComparison(participants, races, stats)[2], {
		userId: 'c',
		recordedRaces: 0,
		actual: 0,
		expected: null,
		difference: null
	});
	races[0].results[0].position = 2;
	assert.equal(calculatePointsComparison(participants, races, stats)[0].difference, 3);
});

test('comparison preserves missing history and resolves tied probabilities', () => {
	assert.deepEqual(calculatePointsComparison(participants, [race('one', [1])], [])[0], {
		userId: 'a',
		recordedRaces: 1,
		actual: 15,
		expected: null,
		difference: null
	});
	const tied = [
		{ trackId: 'one', chances: participants.map((userId) => ({ user: { userId }, chance: 25 })) }
	];
	assert.deepEqual(calculatePointsComparison(participants, [race('one', [1])], tied)[0], {
		userId: 'a',
		recordedRaces: 1,
		actual: 15,
		expected: 15,
		difference: 0
	});
});

test('race-by-race comparisons sum to the total and preserve unrecorded cells', () => {
	const races = [race('one', [4, 1]), race('two', [1, 4, 2, 3]), race('one')];
	const rows = races.map((race) => calculatePointsComparison(participants, [race], stats));
	assert.deepEqual(rows[0][0], {
		userId: 'a',
		recordedRaces: 1,
		actual: 9,
		expected: 15,
		difference: -6
	});
	assert.deepEqual(rows[1][0], {
		userId: 'a',
		recordedRaces: 1,
		actual: 15,
		expected: 9,
		difference: 6
	});
	assert.equal(rows[0][2].difference, null);
	assert.equal(rows[2][0].difference, null);
	const totals = calculatePointsComparison(participants, races, stats);
	for (const [index, total] of totals.entries()) {
		assert.equal(
			rows.reduce((sum, row) => sum + (row[index].difference ?? 0), 0),
			total.difference
		);
		assert.equal(
			rows.reduce((sum, row) => sum + row[index].actual, 0),
			total.actual
		);
	}
});

test('equal rounded chances use unrounded model weight before other track metrics', () => {
	const tied = [
		{
			trackId: 'one',
			chances: participants.map((userId, i) => ({
				user: { userId, finalWeight: 1 + i / 10000, average: i + 1 },
				chance: 25
			}))
		}
	];
	assert.deepEqual(project([race('one')], tied), { a: 9, b: 10, c: 12, d: 15 });
});

test('track average, recent average, best finish, then sample size break equal chances', () => {
	const cases = [
		participants.map((userId, i) => ({ userId, average: 4 - i })),
		participants.map((userId, i) => ({ userId, average: 3, lastFiveResults: [4 - i, null, 25] })),
		participants.map((userId, i) => ({
			userId,
			average: 3,
			lastFiveResults: [3],
			bestResult: 4 - i
		})),
		participants.map((userId, i) => ({
			userId,
			average: 3,
			lastFiveResults: [3],
			bestResult: 1,
			count: i + 1
		}))
	];
	for (const users of cases) {
		const tied = [{ trackId: 'one', chances: users.map((user) => ({ user, chance: 25 })) }];
		assert.deepEqual(project([race('one')], tied), { a: 9, b: 10, c: 12, d: 15 });
		assert.deepEqual(project([race('one', [null, 1])], tied), { a: 9, b: 15, c: 10, d: 12 });
	}
});

test('secondary metrics do not override distinct win chances', () => {
	const chances = [
		{
			trackId: 'one',
			chances: participants.map((userId, i) => ({
				user: { userId, finalWeight: i + 1, average: 4 - i },
				chance: 40 - i * 10
			}))
		}
	];
	assert.deepEqual(project([race('one')], chances), { a: 15, b: 12, c: 10, d: 9 });
});
