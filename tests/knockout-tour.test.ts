import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import type { QueryCtx } from '../src/convex/_generated/server';
import { api } from '../src/convex/_generated/api';
import { getAll, getPlayerResults } from '../src/convex/gps';
import { getOne as getStandings } from '../src/convex/standings';
import type { Doc, Id } from '../src/convex/_generated/dataModel';
import { summarizeGrandPrix, rankGrandPrixStandings } from '../src/lib/grand-prix';
import { buildRecap } from '../src/lib/gp-recap';
import { calculateRecords } from '../src/lib/records';
import { calculateStats } from '../src/lib/stats';
import { aggregatePlayerDirectory } from '../src/lib/player-directory';
import { buildArchive } from '../src/lib/gp-archive';
import { calculateGpOutlook } from '../src/routes/grandprix/[id]/gp-outlook';

const participants = ['a', 'b', 'c', 'd'] as Id<'users'>[];
const users = participants.map((_id) => ({ _id, name: _id }));
const gp = {
	_id: 'gp',
	_creationTime: 0,
	order: 1,
	participants,
	knockoutWinnerId: participants[1]
} as Doc<'grandPrix'>;
const races = [0, 1].map((order) => ({
	_id: `r${order}`,
	grandPrixId: gp._id,
	order,
	trackEndId: 'track',
	trackStartId: 'track',
	transition: false
})) as Doc<'races'>[];
const results = races.flatMap((race, index) =>
	participants.map((userId, player) => ({
		_id: `${race._id}-${userId}`,
		raceId: race._id,
		userId,
		position: player < 3 ? (index === 0 ? 1 : 2) : 24
	}))
) as Doc<'results'>[];
const raceRows = races.map((race) => ({
	...race,
	results: results.filter((result) => result.raceId === race._id)
}));
const standings = participants.map((userId, i) => ({
	grandPrixId: gp._id,
	userId,
	points: i < 3 ? 27 : 2
})) as Doc<'grandPrixStandings'>[];

test('Knockout breaks a three-way first-place draw without changing points or lower ties', () => {
	const summary = summarizeGrandPrix(participants, raceRows, undefined, participants[1]);
	assert.deepEqual(summary.winnerIds, ['b']);
	assert.deepEqual(
		summary.standings.map((row) => [row.userId, row.position, row.points]),
		[
			['b', 1, 27],
			['a', 2, 27],
			['c', 2, 27],
			['d', 4, 2]
		]
	);
	assert.deepEqual(summarizeGrandPrix(participants, raceRows).winnerIds, ['a', 'b', 'c']);
	for (const invalid of ['d', 'outsider']) {
		assert.equal(
			summarizeGrandPrix(participants, raceRows, undefined, invalid as Id<'users'>)
				.knockoutWinnerId,
			undefined
		);
	}
	assert.equal(
		summarizeGrandPrix(participants, [{ results: [] }], undefined, participants[1])
			.knockoutWinnerId,
		undefined
	);
	assert.equal(summarizeGrandPrix([], [], 1, 'b').knockoutWinnerId, undefined);
});

test('recaps, records, statistics, player directory, archive and outlook agree on the Knockout winner', () => {
	const recap = buildRecap(participants, raceRows, undefined, gp.knockoutWinnerId);
	assert.equal(recap.knockoutWinnerId, 'b');
	assert.deepEqual(
		recap.standings.map((row) => row.rank),
		[1, 2, 2, 4]
	);
	assert.equal(recap.margin, 0);
	assert.deepEqual(
		recap.rows.at(-1)!.cells.map((cell) => cell.rank),
		[1, 1, 1, 4]
	);
	const records = calculateRecords(users, [gp], races, results);
	assert.deepEqual(
		records.gpWins.map((row) => row.userId),
		['b']
	);
	assert.equal(records.gpScore.find((row) => row.userId === 'a')!.value, 27);
	assert.equal(records.gpScore.find((row) => row.userId === 'a')!.wonViaKnockout, false);
	assert.equal(records.gpScore.find((row) => row.userId === 'b')!.wonViaKnockout, true);
	const stats = calculateStats(users, [gp], races, results, [], [], []);
	assert.deepEqual(
		stats.players.map((row) => row.gpWins),
		[0, 1, 0, 0]
	);
	assert.deepEqual(stats.timeline[0].gpWins, { a: 0, b: 1, c: 0, d: 0 });
	const directory = aggregatePlayerDirectory(users, [gp], races, results);
	assert.deepEqual(
		directory.map((row) => row.gpWins),
		[0, 1, 0, 0]
	);
	const archive = buildArchive([gp], races, results, standings)[0];
	assert.deepEqual(archive.winnerIds, ['b']);
	assert.equal(archive.knockoutWinnerId, 'b');
	assert.deepEqual(
		archive.standings.map((row) => row.position),
		[1, 2, 2, 4]
	);
	const outlook = calculateGpOutlook(participants, raceRows, [], false, gp.knockoutWinnerId);
	assert.deepEqual(
		outlook.players.map((row) => row.winChance),
		[0, 100, 0, 0]
	);
});

test('manual completion permits a recorded-points tie and reopening ignores its winner', () => {
	const partial = [{ ...raceRows[0], results: raceRows[0].results.slice(0, 3) }];
	assert.equal(summarizeGrandPrix(participants, partial, 1, participants[1]).knockoutWinnerId, 'b');
	assert.equal(
		summarizeGrandPrix(participants, partial, undefined, participants[1]).knockoutWinnerId,
		undefined
	);
});

test('Knockout leaves a separate lower-place draw tied', () => {
	const rows = rankGrandPrixStandings(
		[
			{ userId: 'a', points: 27 },
			{ userId: 'b', points: 27 },
			{ userId: 'c', points: 10 },
			{ userId: 'd', points: 10 }
		],
		'b'
	);
	assert.deepEqual(
		rows.map((row) => [row.userId, row.position]),
		[
			['b', 1],
			['a', 2],
			['c', 3],
			['d', 3]
		]
	);
});

test('removing a Knockout winner clears score annotations and restores shared GP wins across summaries', () => {
	const unresolved = { ...gp, knockoutWinnerId: undefined };
	const records = calculateRecords(users, [unresolved], races, results);
	assert.ok(records.gpScore.every((entry) => !entry.wonViaKnockout));
	assert.deepEqual(
		records.gpWins.map((entry) => entry.userId),
		['a', 'b', 'c']
	);
	assert.equal(
		buildArchive([unresolved], races, results, standings)[0].knockoutWinnerId,
		undefined
	);
	assert.equal(buildRecap(participants, raceRows).knockoutWinnerId, undefined);
	assert.deepEqual(
		calculateStats(users, [unresolved], races, results, [], [], []).players.map(
			(player) => player.gpWins
		),
		[1, 1, 1, 0]
	);
	assert.deepEqual(
		aggregatePlayerDirectory(users, [unresolved], races, results).map((player) => player.gpWins),
		[1, 1, 1, 0]
	);
});

test('home, standings and player-history queries agree on the Knockout winner and preserve points', async () => {
	const currentGp = { ...gp };
	const tables: Record<string, Record<string, unknown>[]> = {
		grandPrix: [currentGp],
		races,
		results,
		grandPrixStandings: standings
	};
	const ctx = {
		db: {
			get: async (id: string) =>
				Object.values(tables)
					.flat()
					.find((row) => row._id === id) ?? null,
			query: (table: string) => {
				const conditions: { field: string; value: unknown }[] = [];
				const collect = async () =>
					tables[table].filter((row) =>
						conditions.every(({ field, value }) => row[field] === value)
					);
				const selector = {
					eq(field: string, value: unknown) {
						conditions.push({ field, value });
						return selector;
					}
				};
				const chain = {
					withIndex(_index: string, callback?: (q: typeof selector) => unknown) {
						callback?.(selector);
						return chain;
					},
					order() {
						return chain;
					},
					filter(
						callback: (q: {
							field: (name: string) => string;
							eq: (field: string, value: unknown) => { field: string; value: unknown };
						}) => { field: string; value: unknown }
					) {
						conditions.push(
							callback({ field: (name) => name, eq: (field, value) => ({ field, value }) })
						);
						return chain;
					},
					collect,
					take: async (count: number) => (await collect()).slice(0, count),
					unique: async () => (await collect())[0] ?? null
				};
				return chain;
			}
		}
	} as unknown as QueryCtx;
	const read = <Q extends FunctionReference<'query'>>(
		_reference: Q,
		implementation: unknown,
		args: FunctionArgs<Q>
	) =>
		(
			implementation as {
				_handler: (ctx: QueryCtx, args: FunctionArgs<Q>) => Promise<FunctionReturnType<Q>>;
			}
		)._handler(ctx, args);
	const home = await read(api.gps.getAll, getAll, {});
	assert.equal(home.page[0].knockoutWinnerId, 'b');
	assert.deepEqual(
		home.page[0].standings.map((row) => [row.userId, row.position, row.points]),
		[
			['b', 1, 27],
			['a', 2, 27],
			['c', 2, 27],
			['d', 4, 2]
		]
	);
	assert.deepEqual(
		await read(api.standings.getOne, getStandings, { grandPrixId: gp._id }),
		home.page[0].standings
	);
	const winner = (
		await read(api.gps.getPlayerResults, getPlayerResults, { userId: participants[1] })
	)[0];
	assert.equal(winner.wonViaKnockout, true);
	assert.equal(winner.won, true);
	assert.equal(winner.points, 27);
	const runnerUp = (
		await read(api.gps.getPlayerResults, getPlayerResults, { userId: participants[0] })
	)[0];
	assert.equal(runnerUp.wonViaKnockout, false);
	assert.equal(runnerUp.won, false);
	assert.equal(runnerUp.points, 27);
	currentGp.knockoutWinnerId = undefined;
	assert.equal((await read(api.gps.getAll, getAll, {})).page[0].knockoutWinnerId, undefined);
	assert.equal(
		(await read(api.gps.getPlayerResults, getPlayerResults, { userId: participants[1] }))[0]
			.wonViaKnockout,
		false
	);
	currentGp.deletedAt = 1;
	assert.deepEqual((await read(api.gps.getAll, getAll, {})).page, []);
	assert.deepEqual(await read(api.standings.getOne, getStandings, { grandPrixId: gp._id }), []);
});
