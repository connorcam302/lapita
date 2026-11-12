import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	buildGpComboFit,
	coverageByTrack,
	weightedSpeed,
	rateCombo,
	rateCharacter,
	rateKart,
	calculateTotal1,
	toTotal1Stats
} from './gp-combo-fit';
import { allTracks } from './data/allTracks';
import characters from './data/characterStats.json';
import karts from './data/kartsStats.json';
import total1Model from './data/total1Model.json';

const refs = {
	tracks: [
		{ _id: 'road', name: 'Peach Stadium' },
		{ _id: 'rough', name: 'Moo Moo Meadows' },
		{ _id: 'water', name: "Wario's Galleon" },
		{ _id: 'unknown', name: 'Unmapped' }
	],
	characters: [
		{ _id: 'mario', name: 'Mario' },
		{ _id: 'bowser', name: 'Bowser' }
	],
	karts: [
		{ _id: 'bike', name: 'Standard Bike' },
		{ _id: 'sled', name: 'Stellar Sled' }
	]
};
const race = (
	order: number,
	kartId: string | undefined = 'bike',
	track = 'road',
	position: number | null = 1,
	characterId: string | undefined = 'mario'
) => ({
	_id: `r${order}`,
	order,
	trackStartId: track,
	trackEndId: track,
	results: [{ userId: 'a', position, characterId, kartId }]
});

test('source covers all 30 main tracks with coherent percentages and the explicit Wario alias', () => {
	assert.equal(coverageByTrack.size, 30);
	for (const { name } of allTracks) {
		const c = coverageByTrack.get(name);
		assert.ok(c, name);
		assert.equal(c.road + c.rough + c.water + c.gliding + c.neutral, 100, name);
	}
	assert.equal(coverageByTrack.get("Wario's Galleon")?.water, 27);
});

test('coverage weights rough, water and gliding with the sheet speed gains; neutral adds no difference', () => {
	const c = { roadSpeed: 2, terrainSpeed: 4, waterSpeed: 6, glidingSpeed: 8 };
	const k = { roadSpeed: 0, terrainSpeed: 0, waterSpeed: 0, glidingSpeed: 0 };
	const coverage = { road: 20, rough: 30, water: 10, gliding: 10, neutral: 30 };
	assert.ok(
		Math.abs(
			weightedSpeed(c, k, coverage) -
				(20 * 0.003 * 2 + 30 * 0.003 * 4 + 10 * 0.006 * 6 + 10 * 0.005 * 8) / 200
		) < 1e-12
	);
	assert.equal(weightedSpeed(c, k, coverage), weightedSpeed(c, k, { ...coverage, neutral: 0 }));
});

test('per-track ratings stay within 0–100 and vary with track coverage', () => {
	for (const track of ['Peach Stadium', 'Koopa Troopa Beach', 'Rainbow Road']) {
		const scores = characters.flatMap((c) => karts.map((k) => rateCombo(track, c.name, k.name)!));
		assert.ok(Math.max(...scores) > Math.min(...scores));
		assert.ok(scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 100));
	}
	assert.notEqual(
		rateCombo('Peach Stadium', 'Mario', 'Stellar Sled'),
		rateCombo('Moo Moo Meadows', 'Mario', 'Stellar Sled')
	);
	assert.equal(rateCombo('Unknown', 'Mario', 'Stellar Sled'), null);
	assert.equal(rateCombo('Peach Stadium', 'Unknown', 'Stellar Sled'), null);
});

test('rates each actual race choice and preserves a switch back as a separate stint', () => {
	const result = buildGpComboFit(['a'], [race(2), race(0), race(1, 'sled', 'rough')], refs)[0];
	const expected =
		(2 * rateCombo('Peach Stadium', 'Mario', 'Standard Bike')! +
			rateCombo('Moo Moo Meadows', 'Mario', 'Stellar Sled')!) /
		3;
	assert.ok(Math.abs(result.score! - expected) < 1e-12);
	assert.equal(result.kartChanges, 2);
	assert.equal(result.setups, 2);
	assert.equal(result.stints.length, 3);
	assert.deepEqual(
		result.rows.map((r) => r.order),
		[0, 1, 2]
	);
	assert.equal(result.ratedRaces, 3);
});

test('character changes affect the rating and stint without inventing a kart switch', () => {
	const result = buildGpComboFit(['a'], [race(0), race(1, 'bike', 'road', 1, 'bowser')], refs)[0];
	assert.notEqual(result.rows[0].score, result.rows[1].score);
	assert.equal(result.stints.length, 2);
	assert.equal(result.setups, 2);
	assert.equal(result.kartChanges, 0);
});

test('missing choices/finishes break continuity and are never carried forward or zero-rated', () => {
	const result = buildGpComboFit(
		['a', 'absent'],
		[
			race(0),
			{ ...race(1), results: [{ userId: 'a', position: 1, characterId: 'mario' }] },
			race(2, 'sled'),
			race(3, 'bike', 'road', null),
			race(4, 'sled')
		],
		refs
	);
	assert.equal(result[0].ratedRaces, 3);
	assert.equal(result[0].kartChanges, 0);
	assert.equal(result[0].rows[1].score, null);
	assert.equal(result[0].rows[1].reason, 'Missing character or kart');
	assert.equal(result[1].score, null);
	assert.equal(result[1].ratedRaces, 0);
});

test('transitions, invalid finishes and unavailable data stay unrated with reasons', () => {
	const transition = { ...race(0), trackStartId: 'rough' };
	const rows = buildGpComboFit(
		['a'],
		[
			transition,
			race(1, 'sled', 'unknown'),
			race(2, 'missing'),
			race(3, 'bike', 'road', 1.5),
			race(4, 'bike', 'road', 25)
		],
		refs
	)[0].rows;
	assert.ok(rows.every((row) => row.score === null));
	assert.deepEqual(
		rows.map((r) => r.reason),
		[
			'No transition coverage',
			'No track coverage',
			'Unknown character or kart stats',
			'No recorded finish',
			'No recorded finish'
		]
	);
	assert.equal(buildGpComboFit(['a'], [], refs)[0].score, null);
	assert.deepEqual(buildGpComboFit([], [], refs), []);
});

test('character and kart ratings vary within their own catalogue independently', () => {
	for (const track of ['Peach Stadium', 'Moo Moo Meadows', "Wario's Galleon"]) {
		for (const values of [
			characters.map((row) => rateCharacter(track, row.name)!),
			karts.map((row) => rateKart(track, row.name)!)
		]) {
			assert.ok(Math.max(...values) > Math.min(...values));
			assert.ok(values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100));
		}
	}
	assert.equal(rateCharacter('Unknown', 'Mario'), null);
	assert.equal(rateKart('Peach Stadium', 'Unknown'), null);
});

test('GP component ratings average actual choices independently and preserve the combined calculation', () => {
	const result = buildGpComboFit(['a'], [race(0), race(1, 'sled', 'rough', 1, 'bowser')], refs)[0];
	assert.equal(
		result.characterScore,
		(rateCharacter('Peach Stadium', 'Mario')! + rateCharacter('Moo Moo Meadows', 'Bowser')!) / 2
	);
	assert.equal(
		result.kartScore,
		(rateKart('Peach Stadium', 'Standard Bike')! + rateKart('Moo Moo Meadows', 'Stellar Sled')!) / 2
	);
	assert.equal(
		result.score,
		(rateCombo('Peach Stadium', 'Mario', 'Standard Bike')! +
			rateCombo('Moo Moo Meadows', 'Bowser', 'Stellar Sled')!) /
			2
	);
	assert.equal(result.rows[0].characterScore, rateCharacter('Peach Stadium', 'Mario'));
	assert.equal(result.rows[1].kartScore, rateKart('Moo Moo Meadows', 'Stellar Sled'));
});

test('missing partner choices permit only known component ratings; transitions and missing finishes permit none', () => {
	const onlyCharacter = {
		...race(0),
		results: [{ userId: 'a', position: 1, characterId: 'mario' }]
	};
	const onlyKart = { ...race(1), results: [{ userId: 'a', position: 1, kartId: 'bike' }] };
	const result = buildGpComboFit(
		['a', 'absent'],
		[onlyCharacter, onlyKart, { ...race(2), trackStartId: 'rough' }, race(3, 'bike', 'road', null)],
		refs
	);
	assert.equal(result[0].characterScore, rateCharacter('Peach Stadium', 'Mario'));
	assert.equal(result[0].kartScore, rateKart('Peach Stadium', 'Standard Bike'));
	assert.equal(result[0].score, null);
	assert.equal(result[0].rows[0].kartScore, null);
	assert.equal(result[0].rows[1].characterScore, null);
	assert.ok(
		result[0].rows.slice(2).every((row) => row.characterScore === null && row.kartScore === null)
	);
	assert.equal(result[1].characterScore, null);
	assert.equal(result[1].kartScore, null);
});

test('Total 1 reproduces source speed, handling, bonuses and totals for three reference rows', () => {
	for (const fixture of total1Model.referenceFixtures) {
		const actual = calculateTotal1(fixture.stats, total1Model.referenceCoverage);
		for (const key of ['speed', 'handling', 'other', 'total'] as const) {
			assert.ok(
				Math.abs(actual[key] - fixture[key]) < 0.00001,
				`row ${fixture.row} ${key}: ${actual[key]} vs ${fixture[key]}`
			);
		}
	}
});

test('source levels are restored before summing choices and nonlinear scoring', () => {
	const swooper = toTotal1Stats(
		characters.find((row) => row.name === 'Swooper')!,
		'character'
	);
	const bike = toTotal1Stats(
		karts.find((row) => row.name === 'Standard Bike')!,
		'kart'
	);
	assert.equal(swooper.roadSpeed, 7);
	assert.equal(swooper.acceleration, 14);
	assert.equal(bike.roadSpeed, -4);
	assert.equal(bike.miniTurbo, 5);
	assert.equal(swooper.coinCurve + bike.coinCurve, 18);
});

test('per-track surfaces change speed and handling while retaining the same other bonuses', () => {
	const stats = total1Model.referenceFixtures[0].stats;
	const road = calculateTotal1(stats, { road: 100, rough: 0, water: 0, gliding: 0, neutral: 0 });
	const water = calculateTotal1(stats, { road: 0, rough: 0, water: 100, gliding: 0, neutral: 0 });
	assert.notEqual(road.speed, water.speed);
	assert.notEqual(road.handling, water.handling);
	assert.equal(road.other, water.other);
	const neutral = calculateTotal1(stats, { road: 0, rough: 0, water: 0, gliding: 0, neutral: 100 });
	assert.equal(neutral.handling, 0);
	assert.ok(neutral.speed > 0, 'coin curve affects neutral surfaces too');
});

test('character rating uses average full-combo totals over all karts before normalization', () => {
	const coverage = coverageByTrack.get('Peach Stadium')!;
	const averages = characters.map((character) => {
		const c = toTotal1Stats(character, 'character');
		return karts.reduce((sum, kart) => {
			const k = toTotal1Stats(kart, 'kart');
			const stats = Object.fromEntries(
				Object.keys(c).map((key) => [key, c[key as keyof typeof c] + k[key as keyof typeof k]])
			) as typeof c;
			return sum + calculateTotal1(stats, coverage).total / karts.length;
		}, 0);
	});
	const min = Math.min(...averages),
		max = Math.max(...averages);
	const index = characters.findIndex((character) => character.name === 'Swooper');
	assert.ok(
		Math.abs(
			rateCharacter('Peach Stadium', 'Swooper')! - (100 * (averages[index] - min)) / (max - min)
		) < 1e-10
	);
});
