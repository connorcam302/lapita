import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { comparePlayerTracks, formatGap } from './track-rivals';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type Track = FunctionReturnType<typeof api.races.getStats>[number];
const player = 'player' as Id<'users'>;
function track(averages: [string, number][]): Track {
	return {
		trackId: 'track' as Id<'tracks'>,
		trackName: 'Rainbow Road',
		trackImg: 'rainbow-road',
		counts: 10,
		averageParticipants: 3,
		userAverages: averages.map(([id, average]) => ({
			userId: id as Id<'users'>,
			userName: id,
			average
		}))
	};
}

test('leaders see their margin over the best other racer, not themselves', () => {
	const [row] = comparePlayerTracks(
		[
			track([
				['player', 2],
				['rival', 2.5],
				['third', 4]
			])
		],
		player
	);
	assert.equal(row.rank, 1);
	assert.equal(row.gap, 0);
	assert.equal(row.margin, 0.5);
	assert.equal(row.rival?.userId, 'rival');
	assert.equal(row.status, 'leading');
});

test('ties share competition ranks and report joint leads', () => {
	const input = [
		track([
			['player', 2],
			['tied', 2],
			['third', 3]
		])
	];
	const [leader] = comparePlayerTracks(input, player);
	assert.equal(leader.rank, 1);
	assert.equal(leader.margin, 0);
	const [third] = comparePlayerTracks(input, 'third' as Id<'users'>);
	assert.equal(third.rank, 3);
	assert.equal(third.gap, 1);
});

test('chasing compares against the leader, using unrounded averages', () => {
	const [row] = comparePlayerTracks(
		[
			track([
				['player', 2.004],
				['leader', 2],
				['other', 2.002]
			])
		],
		player
	);
	assert.equal(row.rank, 3);
	assert.equal(row.status, 'chasing');
	assert.ok(Math.abs(row.gap! - 0.004) < 1e-10);
	assert.equal(formatGap(row.gap!), '<0.01');
	assert.equal(formatGap(0), '0.00');
	assert.equal(formatGap(0.5), '0.50');
});

test('unraced tracks and solo racers do not claim a competitive lead', () => {
	const [unraced] = comparePlayerTracks([track([['rival', 3]])], player);
	assert.equal(unraced.status, 'unraced');
	assert.equal(unraced.rank, null);
	assert.equal(unraced.gap, null);
	assert.equal(unraced.rival?.average, 3);
	const [solo] = comparePlayerTracks(
		[
			track([
				['player', 3],
				['no finishes', NaN]
			])
		],
		player
	);
	assert.equal(solo.status, 'solo');
	assert.equal(solo.margin, null);
	assert.equal(solo.racerCount, 1);
	assert.deepEqual(comparePlayerTracks([], player), []);
});
