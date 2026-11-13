import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatWinPercentages } from './win-percentages';

test('rounding thirds and unequal shares preserves a 100% total', () => {
	for (const values of [
		[1, 1, 1],
		[33.36, 33.36, 33.28],
		[99.94, 0.02, 0.02, 0.02]
	]) {
		const labels = formatWinPercentages(values);
		assert.ok(Math.abs(labels.reduce((sum, label) => sum + parseFloat(label), 0) - 100) < 1e-10);
	}
	assert.deepEqual(formatWinPercentages([1, 1, 1]), ['33.4%', '33.3%', '33.3%']);
});

test('precision adapts to small chances without fixed seven-place rounding', () => {
	assert.deepEqual(formatWinPercentages([99.999999999, 0.000000001]), ['99.999999999%', '1e-9%']);
	assert.deepEqual(formatWinPercentages([99.94, 0.02, 0.02, 0.02]), [
		'99.94%',
		'0.02%',
		'0.02%',
		'0.02%'
	]);
	assert.deepEqual(formatWinPercentages([31.2, 68.8]), ['31.2%', '68.8%']);
});

test('exact certainty, impossible outcomes and unavailable distributions stay distinct', () => {
	assert.deepEqual(formatWinPercentages([100, 0]), ['100%', '0%']);
	assert.deepEqual(formatWinPercentages([NaN, 1]), ['—', '—']);
	assert.deepEqual(formatWinPercentages([]), []);
});
