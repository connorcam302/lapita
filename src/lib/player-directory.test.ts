import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregatePlayerDirectory, filterAndSortPlayers } from './player-directory';
import type { Id } from '../convex/_generated/dataModel';

const id = <T extends 'users' | 'grandPrix' | 'races' | 'characters' | 'karts'>(value: string) =>
	value as Id<T>;
const users = ['Amy', 'Ben', 'New'].map((name) => ({ _id: id<'users'>(name), name }));
const gp = (key: string, extra = {}) => ({
	_id: id<'grandPrix'>(key),
	participants: users.slice(0, 2).map((user) => user._id),
	...extra
});
const race = (key: string, parent: string) => ({
	_id: id<'races'>(key),
	grandPrixId: id<'grandPrix'>(parent)
});
const result = (
	key: string,
	user: string,
	position: number | null,
	character?: string,
	kart?: string
) => ({
	raceId: id<'races'>(key),
	userId: id<'users'>(user),
	position,
	characterId: character ? id<'characters'>(character) : undefined,
	kartId: kart ? id<'karts'>(kart) : undefined
});

test('counts valid recorded finishes in partial races, excludes deleted/orphan/nonparticipant results', () => {
	const rows = aggregatePlayerDirectory(
		users,
		[gp('active'), gp('deleted', { deletedAt: 1 })],
		[race('partial', 'active'), race('removed', 'deleted'), race('orphan', 'missing')],
		[
			result('partial', 'Amy', 1, 'mario', 'bike'),
			result('partial', 'Ben', null),
			result('partial', 'New', 1),
			result('removed', 'Amy', 1),
			result('orphan', 'Amy', 1),
			result('missing', 'Amy', 1)
		]
	);
	assert.deepEqual(rows[0], {
		userId: 'Amy',
		name: 'Amy',
		raceCount: 1,
		raceWins: 1,
		gpWins: 0,
		averageFinish: 1,
		characterId: 'mario',
		kartId: 'bike'
	});
	assert.equal(rows[1].averageFinish, null);
	assert.equal(rows[2].raceCount, 0);
});

test('rejects invalid positions and counts choices independently with stable usage ties', () => {
	const positions = [0, 25, 1.5, null, NaN, 24, 1, 2];
	const rows = aggregatePlayerDirectory(
		users,
		[gp('active')],
		positions.map((_, index) => race(`r${index}`, 'active')),
		positions.map((position, index) =>
			result(
				`r${index}`,
				'Amy',
				position,
				index === 6 ? undefined : index === 5 ? 'z' : 'a',
				index === 7 ? undefined : index === 6 ? 'a' : 'z'
			)
		)
	);
	assert.equal(rows[0].raceCount, 3);
	assert.equal(rows[0].averageFinish, 9);
	assert.equal(rows[0].raceWins, 1);
	assert.equal(rows[0].characterId, 'a');
	assert.equal(rows[0].kartId, 'a');
});

test('GP wins use valid source scores, tied wins, manual completion and nonempty races', () => {
	const gps = [
		gp('tie'),
		gp('manual', { completedAt: 1 }),
		gp('empty', { completedAt: 1 }),
		gp('unfinished')
	];
	const rows = aggregatePlayerDirectory(
		users,
		gps,
		[race('tie', 'tie'), race('manual', 'manual'), race('unfinished', 'unfinished')],
		[
			result('tie', 'Amy', 1),
			result('tie', 'Ben', 1),
			result('manual', 'Amy', 24),
			result('manual', 'Ben', null),
			result('unfinished', 'Ben', 1)
		]
	);
	assert.equal(rows[0].gpWins, 2);
	assert.equal(rows[1].gpWins, 1);
	assert.equal(rows[1].raceWins, 2);
});

test('empty datasets and players without history retain zero counts and null choices', () => {
	assert.deepEqual(aggregatePlayerDirectory([], [], [], []), []);
	for (const player of aggregatePlayerDirectory(users, [], [], [])) {
		assert.equal(player.raceCount, 0);
		assert.equal(player.raceWins, 0);
		assert.equal(player.gpWins, 0);
		assert.equal(player.averageFinish, null);
		assert.equal(player.characterId, null);
		assert.equal(player.kartId, null);
	}
});

test('search and all sort choices are deterministic, averages without history always last', () => {
	const rows = aggregatePlayerDirectory(
		users,
		[gp('gp')],
		[race('race', 'gp')],
		[result('race', 'Amy', 4), result('race', 'Ben', 1)]
	);
	assert.deepEqual(
		filterAndSortPlayers(rows, '  aMY ', 'name', true).map((row) => row.name),
		['Amy']
	);
	assert.equal(filterAndSortPlayers(rows, 'missing', 'name', true).length, 0);
	assert.deepEqual(
		filterAndSortPlayers(rows, '', 'name', false).map((row) => row.name),
		['New', 'Ben', 'Amy']
	);
	for (const sort of ['raceCount', 'raceWins', 'gpWins'] as const) {
		assert.equal(filterAndSortPlayers(rows, '', sort, false).at(-1)!.name, 'New');
	}
	assert.deepEqual(
		filterAndSortPlayers(rows, '', 'averageFinish', true).map((row) => row.name),
		['Ben', 'Amy', 'New']
	);
	assert.deepEqual(
		filterAndSortPlayers(rows, '', 'averageFinish', false).map((row) => row.name),
		['Amy', 'Ben', 'New']
	);
	assert.equal(rows[0].name, 'Amy');
});
