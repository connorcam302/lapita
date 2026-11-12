import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRaceContext, isComplete } from './home-data';

test('GP completion requires a nonempty, completed race list', () => {
	assert.equal(isComplete({ raceCount: 0, completedRaces: 0 }), false);
	assert.equal(isComplete({ raceCount: 16, completedRaces: 15 }), false);
	assert.equal(isComplete({ raceCount: 16, completedRaces: 16 }), true);
});

test('race completion requires every participant and valid positions', async () => {
	const { hasAllResults } = await import('../lib/grand-prix');
	assert.equal(hasAllResults([], []), false);
	assert.equal(hasAllResults(['a', 'b'], [{ userId: 'a', position: 1 }]), false);
	for (const position of [undefined, null, 0, 25, 1.5]) {
		assert.equal(hasAllResults(['a'], [{ userId: 'a', position }]), false);
	}
	assert.equal(
		hasAllResults(
			['a', 'b'],
			[
				{ userId: 'a', position: 1 },
				{ userId: 'b', position: 24 }
			]
		),
		true
	);
	assert.equal(hasAllResults(['a'], [{ userId: 'other', position: 1 }]), false);
});

test('track context follows race order and the first unfinished race, without mutating data', () => {
	const races = [
		{ _id: 'last', order: 2 },
		{ _id: 'first', order: 0 },
		{ _id: 'middle', order: 1 }
	];
	assert.deepEqual(getRaceContext(races, 'middle', false), {
		previous: races[1],
		current: races[2]
	});
	assert.deepEqual(getRaceContext(races, 'first', false), {
		previous: undefined,
		current: races[1]
	});
	assert.deepEqual(getRaceContext(races, null, true), { previous: races[2], current: races[0] });
	assert.equal(races[0]._id, 'last');
});

test('empty, single-race, and missing-current GP track contexts do not invent tracks', () => {
	assert.deepEqual(getRaceContext([], null, true), { previous: undefined, current: undefined });
	const race = { _id: 'only', order: 0 };
	assert.deepEqual(getRaceContext([race], null, true), { previous: undefined, current: race });
	assert.deepEqual(getRaceContext([race], 'missing', false), {
		previous: undefined,
		current: undefined
	});
});

test('manual completion ends a nonempty GP without inventing completed races', () => {
	assert.equal(isComplete({ raceCount: 16, completedRaces: 2, completedAt: 1 }), true);
	assert.equal(isComplete({ raceCount: 16, completedRaces: 2 }), false);
	assert.equal(isComplete({ raceCount: 0, completedRaces: 0, completedAt: 1 }), false);
});
