import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { summarizePlayer } from './player-data';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type Result = FunctionReturnType<typeof api.results.getPlayer>[number];
const race = (position: number | null, time: number): Result => ({
	_id: `result-${time}` as Id<'results'>,
	_creationTime: time,
	raceId: `race-${time}` as Id<'races'>,
	userId: 'player' as Id<'users'>,
	grandPrixId: 'gp' as Id<'grandPrix'>,
	grandPrixOrder: 1,
	trackStartId: 'start' as Id<'tracks'>,
	trackEndId: 'finish' as Id<'tracks'>,
	characterId: 'character' as Id<'characters'>,
	kartId: 'kart' as Id<'karts'>,
	position
});

test('empty profiles have no invented averages or favourite combination', () => {
	const profile = summarizePlayer([], []);
	assert.equal(profile.average, null);
	assert.deepEqual(profile.tracks, []);
	assert.deepEqual(profile.combinations, []);
});

test('averages exclude invalid placements and use available races for recent form', () => {
	const profile = summarizePlayer(
		[race(2, 1), race(4, 2), race(null, 3), race(0, 4), race(25, 5), race(1.5, 6)],
		[]
	);
	assert.equal(profile.finished.length, 2);
	assert.equal(profile.average, 3);
	assert.equal(profile.tracks[0].recentAverage, 3);
	assert.equal(profile.tracks[0].trackEndId, 'finish');
});

test('last ten follow recent records rather than best placements', () => {
	const profile = summarizePlayer(
		Array.from({ length: 12 }, (_, i) => race(i + 1, i)),
		[]
	);
	assert.equal(profile.tracks[0].recentAverage, 7.5);
	assert.equal(profile.finished[0].position, 12);
});

test('combination GP stats use the most-used setup, with no NaN for unused GP attribution', () => {
	const other = { ...race(5, 3), kartId: 'other' as Id<'karts'> };
	const profile = summarizePlayer(
		[race(2, 1), race(4, 2), other],
		[
			{
				grandPrixId: 'gp' as Id<'grandPrix'>,
				order: 1,
				position: 1,
				points: 100
			}
		]
	);
	assert.equal(profile.combinations[0].gpWins, 1);
	assert.equal(profile.combinations[0].averageGpPoints, 100);
	assert.equal(profile.combinations[0].bestTrack, 'start');
	assert.equal(profile.combinations[1].averageGpPoints, null);
});

test('missing character and kart choices still count toward race and track stats', () => {
	const profile = summarizePlayer(
		[{ ...race(3, 1), characterId: undefined, kartId: undefined }],
		[]
	);
	assert.equal(profile.finished.length, 1);
	assert.equal(profile.tracks[0].average, 3);
	assert.deepEqual(profile.combinations, []);
});

test('tied GP combination usage preserves existing query order, independent of recency', () => {
	const profile = summarizePlayer(
		[race(1, 1), { ...race(5, 2), kartId: 'other' as Id<'karts'> }],
		[
			{
				grandPrixId: 'gp' as Id<'grandPrix'>,
				order: 1,
				position: 1,
				points: 100
			}
		]
	);
	assert.equal(profile.combinations.find((combo) => combo.kartId === 'kart')?.gpWins, 1);
	assert.equal(profile.combinations.find((combo) => combo.kartId === 'other')?.gpWins, 0);
});
