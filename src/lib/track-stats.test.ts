import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	summarizeTrack,
	summarizeTrackOverview,
	validPosition,
	type TrackRace
} from './track-stats';

// IDs are fixtures; the summary never queries the database.
const race = (positions: (number | null | undefined)[]): TrackRace =>
	({
		results: positions.map((position, index) => ({
			userId: `player-${index}`,
			position,
			characterId: 'character',
			kartId: 'kart'
		}))
	}) as TrackRace;

test('only integer positions from 1 to 24 count', () => {
	assert.deepEqual([null, undefined, 0, -1, 1.5, 25, NaN, 1, 24].filter(validPosition), [1, 24]);
	const stats = summarizeTrack([race([1, 0, null]), race([3, 24, 1.5])]);
	assert.equal(stats.count, 3);
	assert.equal(stats.wins, 1);
	assert.equal(stats.podiums, 2);
	assert.equal(stats.averageParticipants, 1.5);
	assert.equal(stats.players[0].average, 2);
	assert.equal(stats.combinations[0].count, 3);
	assert.equal(
		stats.distribution.reduce((sum, bucket) => sum + bucket.count, 0),
		3
	);
});

test('empty and unrecorded histories produce no invented stats', () => {
	assert.equal(summarizeTrack([]).average, null);
	assert.equal(summarizeTrack([]).averageParticipants, null);
	const stats = summarizeTrack([race([null, 0])]);
	assert.equal(stats.best, null);
	assert.deepEqual(stats.players, []);
	assert.deepEqual(stats.combinations, []);
});

test('recent form follows newest-first history and consistency measures spread', () => {
	const stats = summarizeTrack([1, 2, 3, 4, 5, 24].map((position) => race([position])));
	assert.equal(stats.players[0].recentAverage, 3);
	assert.equal(stats.players[0].best, 1);
	assert.equal(stats.players[0].worst, 24);
	assert.ok(stats.players[0].consistency! > 0);
});

test('overview and detail agree on valid individual finishes while retaining scheduled races', () => {
	const tracks = [
		{ _id: 'track', name: 'Track', img: 'track' },
		{ _id: 'unraced', name: 'Unraced', img: 'unraced' }
	] as Parameters<typeof summarizeTrackOverview>[0];
	const users = [{ _id: 'player-0', name: 'Player' }] as Parameters<
		typeof summarizeTrackOverview
	>[1];
	// Includes a transition, a partial race, invalid positions and an empty scheduled race.
	const races = [
		race([1, null]),
		race([24, 0, 1.5, 25, NaN]),
		race([null]),
		race([0]),
		race([1.5]),
		race([25])
	].map((r) => ({
		...r,
		trackStartId: 'other' as TrackRace['trackStartId'],
		trackEndId: tracks[0]._id
	}));
	const [overview, unraced] = summarizeTrackOverview(tracks, users, races);
	const detail = summarizeTrack(races);
	assert.equal(overview.counts, races.length);
	assert.equal(overview.averageParticipants, 2 / races.length);
	assert.equal(overview.averageParticipants, detail.averageParticipants);
	assert.equal(overview.userAverages[0].average, detail.players[0].average);
	assert.equal(overview.userAverages[0].average, 12.5);
	assert.equal(unraced.counts, 0);
	assert.equal(unraced.averageParticipants, null);
	assert.deepEqual(unraced.userAverages, []);
});
