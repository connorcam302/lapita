import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateCumulativePoints } from './cumulative-points';

const participants = ['a', 'b', 'c'];

test('scores accumulate in race order with participant-aligned columns and app scoring', () => {
	const races = [
		{
			order: 1,
			results: [
				{ userId: 'c', position: 6 },
				{ userId: 'a', position: 1 },
				{ userId: 'b', position: 24 }
			]
		},
		{
			order: 0,
			results: [
				{ userId: 'b', position: 2 },
				{ userId: 'a', position: 5 }
			]
		}
	];
	const rows = calculateCumulativePoints(participants, races);
	assert.deepEqual(
		rows.map(({ order }) => order),
		[0, 1]
	);
	assert.deepEqual(rows[0].cells, [
		{ userId: 'a', position: 5, total: 9, rank: 2 },
		{ userId: 'b', position: 2, total: 12, rank: 1 },
		{ userId: 'c', position: null, total: 0, rank: 3 }
	]);
	assert.deepEqual(
		rows[1].cells.map(({ total }) => total),
		[24, 13, 8]
	);
	assert.deepEqual(
		races.map(({ order }) => order),
		[1, 0]
	);
});

test('unfinished races retain running totals without inventing a finish or scoring invalid values', () => {
	const rows = calculateCumulativePoints(participants, [
		{
			order: 0,
			results: [
				{ userId: 'a', position: 1 },
				{ userId: 'b', position: 2 },
				{ userId: 'c', position: 3 }
			]
		},
		{
			order: 1,
			results: [
				{ userId: 'a', position: 0 },
				{ userId: 'b', position: 25 },
				{ userId: 'c', position: 1.5 }
			]
		},
		{ order: 2, results: [{ userId: 'a', position: null }] }
	]);
	assert.deepEqual(
		rows[2].cells.map(({ total }) => total),
		[15, 12, 10]
	);
	assert.ok(rows[1].cells.every(({ position }) => position === null));
	assert.ok(rows[2].cells.every(({ position }) => position === null));
	assert.deepEqual(calculateCumulativePoints(participants, []), []);
});

test('tied cumulative leaders use competition ranks and edited results recalculate later rows', () => {
	const races = [
		{
			order: 0,
			results: [
				{ userId: 'a', position: 1 },
				{ userId: 'b', position: 1 },
				{ userId: 'c', position: 2 }
			]
		},
		{
			order: 1,
			results: [
				{ userId: 'a', position: 2 },
				{ userId: 'b', position: 2 },
				{ userId: 'c', position: 1 }
			]
		}
	];
	assert.deepEqual(
		calculateCumulativePoints(participants, races)[0].cells.map(({ rank }) => rank),
		[1, 1, 3]
	);
	assert.deepEqual(
		calculateCumulativePoints(participants, races)[1].cells.map(({ rank }) => rank),
		[1, 1, 1]
	);
	races[0].results[0].position = 24;
	assert.deepEqual(
		calculateCumulativePoints(participants, races)[1].cells.map(({ total }) => total),
		[13, 27, 27]
	);
});
