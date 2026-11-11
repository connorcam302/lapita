import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Doc, Id } from '../convex/_generated/dataModel';
import { buildArchive, filterArchive, type ArchiveFilters } from './gp-archive';

const id = <T extends 'users' | 'grandPrix' | 'races' | 'tracks'>(value: string) => value as Id<T>;
const alice = id<'users'>('alice');
const bob = id<'users'>('bob');
const start = id<'tracks'>('start');
const end = id<'tracks'>('end');
const players = [
	{ _id: alice, name: 'Alice' },
	{ _id: bob, name: 'Bob' }
];
const gps = [1, 2, 3].map((order) => ({
	_id: id<'grandPrix'>(`gp${order}`),
	_creationTime: new Date(2026, 9, order, 23, 59).getTime(),
	order,
	participants: [alice, bob]
}));
const races = gps.slice(0, 2).map((gp) => ({
	_id: id<'races'>(`race${gp.order}`),
	_creationTime: 0,
	grandPrixId: gp._id,
	order: 0,
	trackStartId: start,
	trackEndId: end,
	transition: true
}));
const results = races.flatMap((race, i) =>
	players.map((player) => ({
		_id: `result-${race._id}-${player._id}`,
		_creationTime: 0,
		raceId: race._id,
		userId: player._id,
		position: i === 1 && player._id === bob ? 0 : 1
	}))
) as Doc<'results'>[];
const standings = gps.flatMap((gp) =>
	players.map((player) => ({
		_id: `standing-${gp._id}-${player._id}`,
		_creationTime: 0,
		grandPrixId: gp._id,
		userId: player._id,
		points: 15
	}))
) as Doc<'grandPrixStandings'>[];
const entries = buildArchive(gps, races, results, standings);
const defaults: ArchiveFilters = {
	q: '',
	status: '',
	player: '',
	winner: '',
	track: '',
	from: '',
	to: '',
	sort: ''
};
const filter = (overrides: Partial<ArchiveFilters>) =>
	filterArchive(entries, { ...defaults, ...overrides }, players).map((gp) => gp.order);

test('completion requires valid results for every participant and a nonempty race list', () => {
	assert.deepEqual(
		entries.map((gp) => gp.status),
		['complete', 'in-progress', 'in-progress']
	);
	assert.deepEqual(
		entries.map((gp) => gp.completedRaces),
		[1, 0, 0]
	);
});

test('tied winners count only in complete GPs and share first place', () => {
	assert.deepEqual(entries[0].winnerIds, [alice, bob]);
	assert.deepEqual(
		entries[0].standings.map((s) => s.position),
		[1, 1]
	);
	assert.deepEqual(filter({ winner: bob }), [1]);
});

test('filters search all terms and combine participant, status, track and date inclusively', () => {
	assert.deepEqual(filter({ q: 'gp 1 ALICE' }), [1]);
	assert.deepEqual(
		filter({ player: bob, status: 'complete', track: start, from: '2026-10-01', to: '2026-10-01' }),
		[1]
	);
	assert.deepEqual(filter({ track: end }), [2, 1]);
	assert.deepEqual(filter({ player: 'missing' }), []);
	assert.deepEqual(filter({ from: '2026-10-03', to: '2026-10-01' }), []);
});

test('sorts the whole archive without changing the source', () => {
	assert.deepEqual(filter({}), [3, 2, 1]);
	assert.deepEqual(filter({ sort: 'oldest' }), [1, 2, 3]);
	assert.deepEqual(
		entries.map((gp) => gp.order),
		[1, 2, 3]
	);
	assert.deepEqual(filterArchive([], defaults, players), []);
});
