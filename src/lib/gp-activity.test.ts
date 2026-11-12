import test from 'node:test';
import assert from 'node:assert/strict';
import { groupGpActivity } from './gp-activity';

test('empty history has no activity', () => {
	assert.deepEqual(groupGpActivity([]), []);
});

test('counts each GP once, sorts months and preserves quiet months across years', () => {
	const entries = ['2026-02-02', '2025-12-31', '2025-12-01', '2026-02-28'].map((date) => ({
		date: Date.parse(date)
	}));
	assert.deepEqual(groupGpActivity(entries), [
		{ month: '2025-12', label: 'Dec 2025', gps: 2 },
		{ month: '2026-01', label: 'Jan 2026', gps: 0 },
		{ month: '2026-02', label: 'Feb 2026', gps: 2 }
	]);
});

test('uses UTC month boundaries and ignores invalid timestamps', () => {
	assert.deepEqual(
		groupGpActivity([{ date: Date.parse('2026-03-01T00:30:00+01:00') }, { date: NaN }]),
		[{ month: '2026-02', label: 'Feb 2026', gps: 1 }]
	);
});
