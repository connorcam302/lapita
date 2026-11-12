import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectGpRace } from './race-selection';
const races = [
	{ _id: 'second', order: 1 },
	{ _id: 'first', order: 0 }
];

test('valid deep links keep the requested race', () => {
	assert.equal(selectGpRace(races, 'second')?._id, 'second');
});

test('missing, malformed and unrelated IDs fall back to the first scheduled race', () => {
	for (const id of [null, '', 'invalid', 'another-gp-race']) {
		assert.equal(selectGpRace(races, id)?._id, 'first');
	}
	assert.deepEqual(
		races.map((race) => race._id),
		['second', 'first']
	);
});

test('empty and changed GP race lists never reuse a previous GP selection', () => {
	assert.equal(selectGpRace([], 'first'), undefined);
	assert.equal(selectGpRace([{ _id: 'new', order: 0 }], 'first')?._id, 'new');
});
