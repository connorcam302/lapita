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
			average,
			count: 10
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
	assert.equal(row.signedGap, -0.5);
	assert.equal(row.leaders[0]?.userId, 'player');
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
	assert.equal(leader.signedGap, 0);
	assert.deepEqual(
		leader.leaders.map((racer) => racer.userId),
		['player', 'tied']
	);
	const [third] = comparePlayerTracks(input, 'third' as Id<'users'>);
	assert.equal(third.rank, 3);
	assert.equal(third.gap, 1);
	assert.equal(third.signedGap, 1);
	assert.deepEqual(
		third.leaders.map((racer) => racer.userId),
		['player', 'tied']
	);
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
	assert.equal(unraced.signedGap, null);
	assert.equal(unraced.leaders[0]?.userId, 'rival');
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
	assert.equal(solo.signedGap, null);
	assert.equal(solo.racerCount, 1);
	assert.deepEqual(comparePlayerTracks([], player), []);
});

test('four results never earn a rank or lead; five qualify inclusively', () => {
	const input = track([
		['player', 1],
		['rival', 3],
		['third', 4]
	]);
	input.userAverages[0].count = 4;
	const [low] = comparePlayerTracks([input], player);
	assert.equal(low.status, 'low-sample');
	assert.equal(low.rank, null);
	assert.equal(low.signedGap, null);
	assert.equal(low.leaders[0].userId, 'rival');
	assert.equal(low.player?.count, 4);
	input.userAverages[0].count = 5;
	const [eligible] = comparePlayerTracks([input], player);
	assert.equal(eligible.status, 'leading');
	assert.equal(eligible.rank, 1);
});
