import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverageByTrack, groupTrackCombos, rankTrackCombos, rateCombo } from './gp-combo-fit';
import characters from './data/characterStats.json';
import karts from './data/kartsStats.json';

const characterRefs = characters.map((row) => ({ ...row, _id: row.name }));
const kartRefs = karts.map((row) => ({ ...row, _id: row.name }));

test('displayed rating groups preserve valid pairs and include rounded ties', () => {
	const a = { _id: 'a', name: 'Mario' };
	const b = { _id: 'b', name: 'Luigi' };
	const bike = { _id: 'bike', name: 'Standard Bike' };
	const kart = { _id: 'kart', name: 'Standard Kart' };
	const rows = [
		{ character: a, kart: bike, score: 100, rank: 1 },
		{ character: b, kart: bike, score: 100, rank: 1 },
		{ character: a, kart, score: 99.999, rank: 3 },
		{ character: b, kart, score: 98, rank: 4 }
	];
	assert.deepEqual(groupTrackCombos(rows), [
		{
			rating: '100.00',
			rank: 1,
			setups: [
				{ kart: bike, characters: [a, b] },
				{ kart, characters: [a] }
			]
		},
		{ rating: '98.00', rank: 4, setups: [{ kart, characters: [b] }] }
	]);
	assert.deepEqual(groupTrackCombos([]), []);
});

test('every main track recommends the best model pairs, ordered without rounding scores', () => {
	for (const track of coverageByTrack.keys()) {
		const rows = rankTrackCombos(track, characterRefs, kartRefs);
		assert.equal(rows.length, characters.length * karts.length);
		assert.ok(Math.abs(rows[0].score - 100) < 1e-10, track);
		assert.equal(rows[0].rank, 1);
		for (let index = 0; index < rows.length; index++) {
			const row = rows[index];
			assert.equal(row.score, rateCombo(track, row.character.name, row.kart.name));
			if (index) {
				assert.ok(row.score <= rows[index - 1].score);
				assert.equal(
					row.rank,
					row.score === rows[index - 1].score ? rows[index - 1].rank : index + 1
				);
			}
		}
	}
});

test('only selectable references with known stats appear; IDs and images are preserved', () => {
	const character = { _id: 'mario-id', name: 'Mario', img: 'mario' };
	const kart = { _id: 'bike-id', name: 'Standard Bike', img: 'standard-bike' };
	const rows = rankTrackCombos(
		'Peach Stadium',
		[character, { _id: 'missing' }],
		[kart, { _id: 'unknown', name: 'Unknown kart' }]
	);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].character, character);
	assert.equal(rows[0].kart, kart);
	assert.equal(rows[0].score, rateCombo('Peach Stadium', 'Mario', 'Standard Bike'));
	assert.deepEqual(rankTrackCombos('Unknown track', characterRefs, kartRefs), []);
	assert.deepEqual(rankTrackCombos('Peach Stadium', [], kartRefs), []);
	assert.deepEqual(rankTrackCombos('Peach Stadium', characterRefs, []), []);
});

test('exact ties keep shared competition ranks and stable order without mutating references', () => {
	const refs = [
		{ _id: 'z', name: 'Mario' },
		{ _id: 'a', name: 'Mario' }
	];
	const rows = rankTrackCombos('Peach Stadium', refs, kartRefs);
	assert.deepEqual(
		refs.map((row) => row._id),
		['z', 'a']
	);
	assert.equal(rows[0].rank, rows[1].rank);
	assert.equal(rows[0].character._id, 'a');
	assert.equal(rows[1].character._id, 'z');
	assert.deepEqual(
		rows,
		rankTrackCombos('Peach Stadium', [...refs].reverse(), [...kartRefs].reverse())
	);
});

test('terrain changes recommendations rather than applying one global ranking', () => {
	const road = rankTrackCombos('Peach Stadium', characterRefs, kartRefs)[0];
	const rough = rankTrackCombos('Moo Moo Meadows', characterRefs, kartRefs)[0];
	assert.notDeepEqual(
		[road.character.name, road.kart.name],
		[rough.character.name, rough.kart.name]
	);
});
