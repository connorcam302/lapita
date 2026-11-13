import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calculateGpOutlook, calculateStartingGpOutlook } from './gp-outlook';

const participants = ['a', 'b', 'c', 'd'];
const race = (positions: (number | null | undefined)[] = []) => ({
	trackEndId: 'track',
	results: positions.map((position, i) => ({ userId: participants[i], position }))
});
const stats = [
	{
		trackId: 'track',
		chances: [40, 30, 20, 10].map((chance, i) => ({ user: { userId: participants[i] }, chance }))
	}
];

test('completed GP outcomes are exact and ties use competition places', () => {
	const outlook = calculateGpOutlook(participants, [race([1, 1, 2, 4])], []);
	assert.equal(outlook.simulations, 0);
	assert.equal(outlook.completedRaces, 1);
	assert.deepEqual(
		outlook.players.map((p) => [
			p.points,
			p.minimum,
			p.maximum,
			p.projected,
			p.remaining,
			p.winChance,
			p.podiumChance
		]),
		[
			[15, 15, 15, 15, 0, 50, 100],
			[15, 15, 15, 15, 0, 50, 100],
			[12, 12, 12, 12, 0, 0, 100],
			[9, 9, 9, 9, 0, 0, 0]
		]
	);
});

test('partial finishes reserve occupied places for limits and simulations', () => {
	const outlook = calculateGpOutlook(participants, [race([null, 1, null, 24])], stats);
	assert.equal(outlook.completedRaces, 0);
	assert.deepEqual(
		outlook.players.map((p) => [p.minimum, p.maximum, p.remaining]),
		[
			[2, 12, 1],
			[15, 15, 0],
			[2, 12, 1],
			[1, 1, 0]
		]
	);
	assert.deepEqual(
		outlook.players.map((p) => p.winChance),
		[0, 100, 0, 0]
	);
	assert.deepEqual(
		outlook.players.map((p) => p.podiumChance),
		[100, 100, 100, 0]
	);
});

test('unplayed race win frequencies follow weights and forecasts are repeatable', () => {
	const outlook = calculateGpOutlook(participants, [race()], stats);
	assert.equal(outlook.simulations, 5000);
	for (const [i, player] of outlook.players.entries()) {
		assert.ok(Math.abs(player.winChance! - stats[0].chances[i].chance) < 3);
		assert.ok(player.podiumChance! >= player.winChance!);
	}
	assert.deepEqual(outlook, calculateGpOutlook(participants, [race()], stats));
});

test('minimum and maximum add the real 24-place scoring to recorded points', () => {
	const outlook = calculateGpOutlook(participants, [race([24, 12, 6, 1]), race()], stats);
	assert.deepEqual(
		outlook.players.map((p) => [p.points, p.minimum, p.maximum]),
		[
			[1, 2, 16],
			[6, 7, 21],
			[8, 9, 23],
			[15, 16, 30]
		]
	);
});

test('missing history leaves chance estimates unavailable but keeps points limits', () => {
	const outlook = calculateGpOutlook(participants, [race([2]), race()], []);
	assert.equal(outlook.simulations, 0);
	assert.deepEqual(
		outlook.players.map((p) => p.winChance),
		[null, null, null, null]
	);
	assert.deepEqual(outlook.players[0], {
		userId: 'a',
		points: 12,
		minimum: 13,
		maximum: 27,
		remaining: 1,
		projected: null,
		winChance: null,
		podiumChance: null
	});
});

test('zero weights and invalid finishes never create NaN probabilities', () => {
	const weighted = [
		{
			trackId: 'track',
			chances: participants.map((userId, i) => ({ user: { userId }, chance: i === 0 ? 100 : 0 }))
		}
	];
	const outlook = calculateGpOutlook(participants, [race([0, 25, 1.5, null])], weighted);
	assert.deepEqual(
		outlook.players.map((p) => p.winChance),
		[100, 0, 0, 0]
	);
	assert.ok(outlook.players.every((p) => Number.isFinite(p.podiumChance)));
	assert.equal(outlook.completedRaces, 0);
});

test('empty GPs do not claim wins', () => {
	const outlook = calculateGpOutlook(participants, [], []);
	assert.ok(outlook.players.every((p) => p.winChance === null));
	assert.deepEqual(calculateGpOutlook([], [], []).players, []);
});

test('starting forecasts ignore recorded finishes and occupied positions', () => {
	const unplayed = calculateGpOutlook(participants, [race(), race()], stats);
	const starting = calculateStartingGpOutlook(
		participants,
		[race([24, 1, 2, 3]), race([4])],
		stats
	);
	assert.deepEqual(starting, unplayed);
	assert.notDeepEqual(
		starting,
		calculateGpOutlook(participants, [race([24, 1, 2, 3]), race([4])], stats)
	);
});

test('starting forecasts need history even when every result is recorded', () => {
	const starting = calculateStartingGpOutlook(participants, [race([1, 2, 3, 4])], []);
	assert.ok(
		starting.players.every((player) => player.projected === null && player.winChance === null)
	);
});

test('manual completion fixes outcomes to recorded points with no remaining forecasts', () => {
	const outlook = calculateGpOutlook(participants, [race([1, 1, 2, null]), race()], [], true);
	assert.equal(outlook.completedRaces, 0);
	assert.equal(outlook.simulations, 0);
	assert.deepEqual(
		outlook.players.map((p) => [
			p.points,
			p.minimum,
			p.maximum,
			p.projected,
			p.remaining,
			p.winChance
		]),
		[
			[15, 15, 15, 15, 0, 50],
			[15, 15, 15, 15, 0, 50],
			[12, 12, 12, 12, 0, 0],
			[0, 0, 0, 0, 0, 0]
		]
	);
});

test('tied simulated leaders share win credit and chances sum to 100', () => {
	const outlook = calculateGpOutlook(participants, [race(), race(), race()], stats);
	assert.ok(
		Math.abs(outlook.players.reduce((sum, player) => sum + player.winChance!, 0) - 100) < 1e-9
	);
});
