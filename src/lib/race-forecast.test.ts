import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTrackForecastStats, recencyWeightedAverage } from './race-forecast';
import { calculateRaceWinChance } from './utils';
import {
	calculateExpectedPoints,
	calculatePointsComparison
} from '../routes/grandprix/[id]/expected-points';
import {
	calculateGpOutlook,
	calculateStartingGpOutlook
} from '../routes/grandprix/[id]/gp-outlook';

const close = (actual: number | null, expected: number) =>
	assert.ok(actual !== null && Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('the most recent ten valid finishes receive equal weight, including short histories', () => {
	assert.equal(recencyWeightedAverage([]), null);
	assert.equal(recencyWeightedAverage([null, undefined, 0, 25, 1.5, NaN]), null);
	assert.equal(recencyWeightedAverage([4]), 4);
	close(recencyWeightedAverage([1, 3]), 2);
	close(recencyWeightedAverage([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 5.5);
	close(recencyWeightedAverage([0, 1, null, 3, 25, 1.5]), 2);
});

test('the eleventh finish weighs 90%, the twelfth 81%, and later finishes decay progressively', () => {
	close(recencyWeightedAverage([...Array(10).fill(1), 24]), (10 + 24 * 0.9) / 10.9);
	close(
		recencyWeightedAverage([...Array(10).fill(1), 24, 12]),
		(10 + 24 * 0.9 + 12 * 0.81) / 11.71
	);
	const nearer = recencyWeightedAverage([...Array(10).fill(1), 24, 1])!;
	const older = recencyWeightedAverage([...Array(10).fill(1), 1, 24])!;
	assert.ok(nearer > older);
	close(recencyWeightedAverage(Array(10000).fill(7)), 7);
});

const finish = (
	userId: string,
	gp: number,
	race: number,
	position: number | null,
	createdAt = gp * 100 + race
) => ({
	userId,
	grandPrixOrder: gp,
	raceOrder: race,
	position,
	createdAt,
	id: `${userId}-${gp}-${race}`
});

test('recency follows GP and race order, even when old results are backfilled later', () => {
	const history = [
		finish('a', 2, 0, 24, 999999),
		...Array.from({ length: 10 }, (_, i) => finish('a', 3, i, 1)),
		finish('a', 1, 0, 12, 9999999),
		finish('a', 4, 0, null),
		finish('a', 4, 1, 0),
		finish('a', 4, 2, 25),
		finish('b', 4, 0, 8)
	].reverse();
	const before = structuredClone(history);
	const stats = buildTrackForecastStats(history);
	const a = stats.find((s) => s.userId === 'a')!;
	close(a.weightedAvg, (10 + 24 * 0.9 + 12 * 0.81) / 11.71);
	assert.equal(a.avg, 46 / 12);
	assert.equal(a.count, 12);
	assert.deepEqual(a.lastFiveResults, [1, 1, 1, 1, 1]);
	assert.equal(a.bestResult, 1);
	assert.equal(stats.find((s) => s.userId === 'b')!.weightedAvg, 8);
	assert.deepEqual(history, before);
});

test('weighted track history changes race xP and both GP forecasts, keeping actual scores intact', () => {
	const history = Array.from({ length: 20 }, (_, i) => [
		finish('a', i + 1, 0, i < 10 ? 24 : 1),
		finish('b', i + 1, 0, 12)
	]).flat();
	const stats = buildTrackForecastStats(history);
	const chances = (weighted: boolean) => [
		{
			trackId: 'track',
			chances: calculateRaceWinChance(
				stats.map((s) => ({ ...s, trackId: 'track', avg: weighted ? s.weightedAvg : s.avg }))
			)[0]
		}
	];
	const participants = ['a', 'b'];
	const race = { trackEndId: 'track', results: [] as { userId: string; position: number }[] };
	assert.equal(calculateExpectedPoints(participants, [race], chances(false)).get('a'), 12);
	assert.equal(calculateExpectedPoints(participants, [race], chances(true)).get('a'), 15);
	const races = [race, race];
	for (const outlook of [
		calculateGpOutlook(participants, races, chances(true)),
		calculateStartingGpOutlook(participants, races, chances(true))
	]) {
		assert.equal(outlook.players.find((p) => p.userId === 'a')!.projected, 30);
		assert.equal(outlook.players.find((p) => p.userId === 'b')!.projected, 24);
	}
	const completed = {
		...race,
		results: [
			{ userId: 'a', position: 2 },
			{ userId: 'b', position: 1 }
		]
	};
	assert.equal(calculateExpectedPoints(participants, [completed], chances(true)).get('a'), 12);
	assert.equal(
		calculatePointsComparison(participants, [completed], chances(true))[0].difference,
		-3
	);
});
