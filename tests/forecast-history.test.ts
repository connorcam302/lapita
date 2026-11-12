import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stats } from '../src/convex/results';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { api } from '../src/convex/_generated/api';
import type { QueryCtx } from '../src/convex/_generated/server';
import type { Id } from '../src/convex/_generated/dataModel';
import { calculateStartingGpOutlook } from '../src/routes/grandprix/[id]/gp-outlook';

type Forecast = Omit<FunctionReturnType<typeof api.results.stats>[number], 'chances'> & {
	chances: { user: { userId: string; average: number }; chance: number }[];
};
const queryStats = (
	stats as unknown as {
		_handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.results.stats>) => Promise<Forecast[]>;
	}
)._handler;

type Row = { _id: string; [key: string]: unknown };

function fixture() {
	const rows: Record<string, Row[]> = {
		grandPrix: [
			{ _id: 'past', order: 1 },
			{ _id: 'current', order: 2 },
			{ _id: 'future', order: 3 },
			{ _id: 'deleted', order: 0, deletedAt: 1 }
		],
		races: [
			{ _id: 'known', grandPrixId: 'past', order: 0, trackStartId: 'track', trackEndId: 'track' },
			...['past', 'current', 'future', 'deleted'].map((gp) => ({
				_id: gp + '-race',
				grandPrixId: gp,
				order: 1,
				trackStartId: 'other',
				trackEndId: 'other'
			}))
		],
		results: [
			{ _id: 'a', raceId: 'known', userId: 'a', position: 4, _creationTime: 1 },
			...['past', 'current', 'future', 'deleted'].map((gp) => ({
				_id: gp + '-result',
				raceId: gp + '-race',
				userId: 'b',
				position: gp === 'past' ? 2 : 24,
				_creationTime: 1
			})),
			{ _id: 'invalid', raceId: 'past-race', userId: 'new', position: 0, _creationTime: 1 }
		]
	};
	const db = {
		get: async (id: string) =>
			Object.values(rows)
				.flat()
				.find((row) => row._id === id) ?? null,
		query(table: string) {
			const filters: [string, unknown][] = [];
			const builder = {
				eq(field: string, value: unknown) {
					filters.push([field, value]);
					return builder;
				}
			};
			const collect = async () =>
				rows[table].filter((row) => filters.every(([field, value]) => row[field] === value));
			return {
				withIndex(_name: string, callback: (q: typeof builder) => unknown) {
					callback(builder);
					return { collect, unique: async () => (await collect())[0] ?? null };
				}
			};
		}
	};
	return { db } as unknown as QueryCtx;
}

test('missing track history uses overall form with no future or deleted history in starting forecasts', async () => {
	const participants = ['a', 'b', 'new'] as Id<'users'>[];
	const forecast = await queryStats(fixture(), {
		tracks: ['track', 'unraced'] as Id<'tracks'>[],
		users: participants,
		beforeGrandPrixId: 'current' as Id<'grandPrix'>
	});
	const known = forecast[0];
	assert.deepEqual(
		known.stats.map((s) => s.userId),
		['a']
	);
	assert.equal(known.chances.find((c) => c.user.userId === 'a')!.user.average, 4);
	assert.equal(known.chances.find((c) => c.user.userId === 'b')!.user.average, 2);
	assert.equal(known.chances.find((c) => c.user.userId === 'new')!.user.average, 12.5);
	assert.equal(forecast[1].stats.length, 0);
	assert.equal(forecast[1].chances.length, participants.length);
	const outlook = calculateStartingGpOutlook(
		participants,
		forecast.map(({ trackId }) => ({ trackEndId: trackId, results: [] })),
		forecast
	);
	assert.deepEqual(
		outlook.players.map((p) => p.projected),
		[24, 30, 20]
	);
	assert.ok(outlook.players.every((p) => Number.isFinite(p.winChance)));
});

test('a completely new group on an unraced track receives equal finite chances', async () => {
	const forecast = await queryStats(fixture(), {
		tracks: ['unraced'] as Id<'tracks'>[],
		users: ['new', 'newer'] as Id<'users'>[]
	});
	assert.deepEqual(
		forecast[0].chances.map((c) => c.chance),
		[50, 50]
	);
});
