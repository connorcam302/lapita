import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateRecords } from './records';
import type { Id } from '../convex/_generated/dataModel';

const userId = (id: string) => id as Id<'users'>;
const gpId = (id: string) => id as Id<'grandPrix'>;
const raceId = (id: string) => id as Id<'races'>;
const users = ['Ada', 'Bea', 'Cal'].map((name) => ({ _id: userId(name), name }));
function fixture(positions: (number | null | undefined)[][]) {
	const gps = [{ _id: gpId('gp'), order: 1, participants: users.map((user) => user._id) }];
	const races = positions.map((_, order) => ({
		_id: raceId(`race${order}`),
		grandPrixId: gpId('gp'),
		order
	}));
	const results = positions.flatMap((row, index) =>
		row.map((position, player) => ({
			raceId: races[index]._id,
			userId: users[player]._id,
			position
		}))
	);
	return { gps, races, results };
}

test('empty history has no records, including players with no results', () => {
	const data = calculateRecords(users, [], [], []);
	assert.equal(data.completedRaces, 0);
	assert.deepEqual(data.gpScore, []);
	assert.deepEqual(data.raceWins, []);
	assert.deepEqual(data.average, []);
});

test('only completed participant races count and unfinished GPs earn no GP records', () => {
	const { gps, races, results } = fixture([
		[1, 2, 3],
		[1, null, 4],
		[1, 2, 25],
		[1, 2, 1.5],
		[1, 2, undefined],
		[1, 2, 0]
	]);
	const data = calculateRecords(users, gps, races, results);
	assert.equal(data.completedRaces, 1);
	assert.equal(data.completedGps, 0);
	assert.equal(data.raceWins[0].value, 1);
	assert.deepEqual(data.gpScore, []);
	assert.deepEqual(data.gpWins, []);
});

test('scores follow Lapita points and GP ties count for both winners', () => {
	const { gps, races, results } = fixture([
		[1, 2, 24],
		[2, 1, 24]
	]);
	const data = calculateRecords(users, gps, races, results);
	assert.equal(data.completedGps, 1);
	assert.deepEqual(
		data.gpScore.map(({ value, rank }) => [value, rank]),
		[
			[27, 1],
			[27, 1],
			[2, 3]
		]
	);
	assert.deepEqual(
		data.gpWins.map(({ name }) => name),
		['Ada', 'Bea']
	);
	assert.equal(data.gpScore[0].grandPrixId, gpId('gp'));
	assert.equal(data.gpScore[0].raceCount, 2);
});

test('average requires ten races and ranks lower finishes first', () => {
	const { gps, races, results } = fixture(Array.from({ length: 10 }, () => [3, 1, 2]));
	const data = calculateRecords(users, gps, races, results);
	assert.deepEqual(
		data.average.map(({ name, value }) => [name, value]),
		[
			['Bea', 1],
			['Cal', 2],
			['Ada', 3]
		]
	);
	assert.equal(calculateRecords(users, gps, races.slice(0, 9), results).average.length, 0);
});

test('streaks use GP/race order, cross GPs, and break on losses or unfinished races', () => {
	const { gps, races, results } = fixture([
		[1, 2, 3],
		[1, 2, 3],
		[1, null, 3],
		[1, 2, 3],
		[1, 2, 3],
		[1, 2, 3],
		[2, 1, 3]
	]);
	const nextGp = { _id: gpId('next'), order: 2, participants: users.map((user) => user._id) };
	const nextRace = { _id: raceId('next'), grandPrixId: nextGp._id, order: 0 };
	const nextResults = [2, 1, 3].map((position, index) => ({
		raceId: nextRace._id,
		userId: users[index]._id,
		position
	}));
	const data = calculateRecords(
		users,
		[nextGp, ...gps],
		[nextRace, ...races.toReversed()],
		[...nextResults, ...results.toReversed()]
	);
	assert.equal(data.winStreak.find((entry) => entry.name === 'Ada')?.value, 3);
	assert.equal(data.winStreak.find((entry) => entry.name === 'Bea')?.value, 2);
});

test('nonparticipant results do not affect records and empty GPs stay incomplete', () => {
	const { gps, races, results } = fixture([[4, 5, 6]]);
	const outsider = { _id: userId('outsider'), name: 'Outsider' };
	results.push({ userId: outsider._id, raceId: races[0]._id, position: 1 });
	const data = calculateRecords(
		[...users, outsider],
		[...gps, { _id: gpId('empty'), order: 2, participants: [] }],
		races,
		results
	);
	assert.equal(data.completedGps, 1);
	assert.deepEqual(data.raceWins, []);
	assert.equal(data.gpScore[0].value, 9);
});

test('manual completion counts valid partial results, ignores missing and invalid finishes, and shares tied wins', () => {
	const { gps, races, results } = fixture([
		[1, 2, null],
		[null, 22, 25]
	]);
	const manual = gps.map((gp) => ({ ...gp, completedAt: 1 }));
	const data = calculateRecords(users, manual, races, results);
	assert.equal(data.completedGps, 1);
	assert.equal(data.completedRaces, 0);
	assert.deepEqual(data.raceWins, []);
	assert.deepEqual(
		data.gpScore.map(({ name, value }) => [name, value]),
		[
			['Ada', 15],
			['Bea', 14],
			['Cal', 0]
		]
	);
	results[4].position = 21;
	assert.deepEqual(
		calculateRecords(users, manual, races, results).gpWins.map(({ name }) => name),
		['Ada', 'Bea']
	);
	assert.deepEqual(calculateRecords(users, gps, races, results).gpWins, []);
	assert.equal(calculateRecords(users, manual, [], []).completedGps, 0);
});
