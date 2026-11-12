import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eraColor, groupEraBands } from './gp-era-bands';

test('groups contiguous tagged GPs, including single-GP eras and repeated names', () => {
	const bands = groupEraBands([
		{ order: 3 },
		...[4, 5, 6, 7, 8].map((order) => ({ order, era: 'Dixie Dean Arc' })),
		{ order: 9, era: 'Next arc' },
		{ order: 10, era: 'Dixie Dean Arc' }
	]);
	assert.deepEqual(
		bands.map(({ era, from, to }) => ({ era, from, to })),
		[
			{ era: 'Dixie Dean Arc', from: 4, to: 8 },
			{ era: 'Next arc', from: 9, to: 9 },
			{ era: 'Dixie Dean Arc', from: 10, to: 10 }
		]
	);
	assert.equal(bands[0].color, bands[2].color);
	assert.notEqual(bands[0].color, bands[1].color);
});

test('untagged GPs and missing GP numbers stay outside era shading', () => {
	const bands = groupEraBands([
		{ order: 4, era: 'Arc' },
		{ order: 5 },
		{ order: 6, era: 'Arc' },
		{ order: 8, era: 'Arc' }
	]);
	assert.deepEqual(
		bands.map(({ from, to }) => [from, to]),
		[
			[4, 4],
			[6, 6],
			[8, 8]
		]
	);
	assert.deepEqual(groupEraBands([]), []);
	assert.deepEqual(groupEraBands([{ order: 1 }]), []);
});

test('sorts without mutating input and keeps a name’s color independent of other eras', () => {
	const input = [
		{ order: 5, era: 'Arc' },
		{ order: 4, era: 'Arc' }
	];
	assert.deepEqual(
		groupEraBands(input).map(({ from, to }) => [from, to]),
		[[4, 5]]
	);
	assert.deepEqual(
		input.map((gp) => gp.order),
		[5, 4]
	);
	assert.equal(groupEraBands([{ order: 20, era: 'Arc' }])[0].color, eraColor('Arc'));
});
