import assert from 'node:assert/strict';
import test from 'node:test';
import characters from './characterStats.json';
import karts from './kartsStats.json';
import { calculatorStats, characterDataset, kartDataset } from './StatsDataset';

test('all 90 dataset entries provide every varying calculator stat', () => {
	assert.equal(characters.length, 50);
	assert.equal(karts.length, 40);
	assert.equal(calculatorStats.length, 13);
	assert.equal(new Set(calculatorStats.map(({ key }) => key)).size, 13);
	for (const rows of [characters, karts]) {
		for (const { key } of calculatorStats) {
			for (const row of rows) {
				assert.ok(Number.isFinite(row[key]), `${row.name}: ${key} must be numeric`);
				assert.ok(row[key] >= 0, `${row.name}: ${key} must be zero-based`);
			}
		}
	}
	for (const { key } of calculatorStats) {
		assert.ok(
			new Set(characters.map((row) => row[key])).size > 1 ||
				new Set(karts.map((row) => row[key])).size > 1,
			`${key} must vary within at least one dataset`
		);
	}
});

test('new stats retain sheet differences after zero-based normalization', () => {
	const bowser = characterDataset.getByName('Bowser')!;
	const mario = characterDataset.getByName('Mario')!;
	const bike = kartDataset.getByName('Standard Bike')!;
	const sled = kartDataset.getByName('Stellar Sled')!;
	// Sheet values: Bowser/Mario gliding 12/10; invincibility 18/12.
	assert.equal(bowser.glidingSpeed, 2);
	assert.equal(mario.glidingSpeed, 0);
	assert.equal(bowser.invincibility, 13);
	assert.equal(mario.invincibility, 7);
	// Sheet values: Standard Bike mini-turbo 5, coin curve 3, traction 2.
	assert.equal(bike.miniTurbo, 9);
	assert.equal(bike.coinCurve, 6);
	assert.equal(bike.traction, 4);
	assert.equal(sled.glidingSpeed, 1);
	assert.equal(sled.invincibility, 8);
	assert.equal(mario.roadSpeed, 4);
	assert.equal(sled.waterSpeed, 11);
	assert.equal(characterDataset.getByName('Unknown character'), undefined);
});
