import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats } from './stats';
import { calculateRecords } from './records';
import type { Id } from '../convex/_generated/dataModel';

const alice = 'alice' as Id<'users'>;
const bob = 'bob' as Id<'users'>;
const outsider = 'outsider' as Id<'users'>;
const track = 'track' as Id<'tracks'>;
const character = 'character' as Id<'characters'>;
const kart = 'kart' as Id<'karts'>;
const users = [
	{ _id: alice, name: 'Alice' },
	{ _id: bob, name: 'Bob' },
	{ _id: outsider, name: 'Outsider' }
];
const gp = (order: number, extras = {}) => ({
	_id: `gp${order}` as Id<'grandPrix'>,
	_creationTime: order * 1000,
	order,
	participants: [alice, bob],
	...extras
});
const race = (order: number, grandPrixId = 'gp1') => ({
	_id: `race${grandPrixId}-${order}` as Id<'races'>,
	order,
	grandPrixId: grandPrixId as Id<'grandPrix'>,
	trackEndId: track
});
const result = (r: ReturnType<typeof race>, userId: Id<'users'>, position: number | null) => ({
	raceId: r._id,
	userId,
	position,
	characterId: character,
	kartId: kart
});
const calculate = (
	gps: Parameters<typeof calculateStats>[1],
	races: Parameters<typeof calculateStats>[2],
	results: Parameters<typeof calculateStats>[3]
) =>
	calculateStats(
		users,
		gps,
		races,
		results,
		[{ _id: track, name: 'Track' }],
		[{ _id: character, name: 'Mario' }],
		[{ _id: kart, name: 'Kart' }]
	);

test('empty history produces finite zero totals and no averages', () => {
	const stats = calculate([], [], []);
	assert.equal(stats.completedGps, 0);
	assert.equal(stats.completedRaces, 0);
	assert.deepEqual(stats.timeline, []);
	assert.ok(stats.players.every((p) => p.average === null && p.winRate === 0));
});

test('timeline is cumulative in GP order, ignores outsiders and excludes deleted parents', () => {
	const gps = [gp(3, { deletedAt: 100 }), gp(2), gp(1)];
	const races = [race(0), race(0, 'gp2'), race(0, 'gp3')];
	const results = races.flatMap((r, i) => [
		result(r, alice, i === 1 ? 2 : 1),
		result(r, bob, i === 1 ? 1 : 2),
		result(r, outsider, 1)
	]);
	const stats = calculate(gps, races, results);
	assert.equal(stats.completedRaces, 2);
	assert.equal(stats.completedGps, 2);
	assert.deepEqual(
		stats.timeline.map((entry) => [entry.order, entry.gpWins[alice], entry.raceWins[bob]]),
		[
			[1, 1, 0],
			[2, 1, 1]
		]
	);
	assert.equal(stats.players[0].points, 27);
	assert.equal(stats.players[0].average, 1.5);
	assert.equal(stats.players[0].winRate, 50);
	assert.equal(stats.players[2].races, 0);
	assert.equal(stats.tracks[0].count, 2);
	assert.equal(stats.combos[0].count, 4);
});

test('partial and invalid races do not count; completed races in ongoing GPs do', () => {
	const races = [race(0), race(1), race(2), race(3), race(4)];
	const results = [
		result(races[0], alice, 1),
		result(races[0], bob, 3),
		result(races[1], alice, 1),
		result(races[1], bob, null),
		result(races[2], alice, 1.5),
		result(races[2], bob, 2),
		result(races[3], alice, 25),
		result(races[3], bob, 2),
		result(races[4], alice, 0),
		result(races[4], bob, 2)
	];
	const stats = calculate([gp(1)], races, results);
	assert.equal(stats.completedGps, 0);
	assert.equal(stats.completedRaces, 1);
	assert.equal(stats.timeline[0].raceWins[alice], 1);
	assert.equal(stats.timeline[0].gpWins[alice], 0);
	assert.equal(stats.players[0].finishes[0], 1);
	assert.equal(stats.players[1].podiums, 1);
});

test('GP ties credit each winner; race wins require actual first place', () => {
	const races = [race(0), race(1)];
	const results = races.flatMap((r, i) => [result(r, alice, i + 1), result(r, bob, 2 - i)]);
	const stats = calculate([gp(1)], races, results);
	assert.equal(stats.timeline[0].gpWins[alice], 1);
	assert.equal(stats.timeline[0].gpWins[bob], 1);
	assert.equal(stats.timeline[0].raceWins[alice], 1);
});

test('manual completion uses recorded points for GP wins and matches Records', () => {
	const gps = [gp(1, { completedAt: 100 })];
	const races = [race(0), race(1)];
	const results = [result(races[0], alice, 1), result(races[0], bob, 2), result(races[1], bob, 1)];
	const stats = calculate(gps, races, results);
	const records = calculateRecords(users, gps, races, results);
	assert.equal(stats.completedGps, records.completedGps);
	assert.equal(stats.completedRaces, records.completedRaces);
	assert.equal(stats.timeline[0].gpWins[bob], 1);
	assert.equal(stats.timeline[0].raceWins[bob], 0);
	assert.equal(stats.players[1].gpEntries, 1);
});

test('manual completion with no scheduled races does not count a GP', () => {
	assert.equal(calculate([gp(1, { completedAt: 100 })], [], []).completedGps, 0);
});

test('timeline carries current era tags, excludes deleted eras, and preserves win totals', () => {
	const gps = [
		gp(1, { era: 'Dixie Dean Arc' }),
		gp(2),
		gp(3, { era: 'Deleted arc', deletedAt: 1 })
	];
	const races = [race(0), race(0, 'gp2')];
	const results = races.flatMap((r) => [result(r, alice, 1), result(r, bob, 2)]);
	const stats = calculate(gps, races, results);
	assert.deepEqual(
		stats.timeline.map(({ order, era }) => [order, era]),
		[
			[1, 'Dixie Dean Arc'],
			[2, undefined]
		]
	);
	assert.deepEqual(
		stats.timeline.map((gp) => gp.gpWins[alice]),
		[1, 2]
	);
	assert.deepEqual(
		stats.timeline.map((gp) => gp.raceWins[alice]),
		[1, 2]
	);
});
