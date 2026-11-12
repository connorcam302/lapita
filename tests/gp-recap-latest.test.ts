import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestCompleted } from '../src/convex/gps';
import type { Id } from '../src/convex/_generated/dataModel';
import type { QueryCtx } from '../src/convex/_generated/server';

const handler = (
	latestCompleted as unknown as {
		_handler: (
			ctx: QueryCtx,
			args: Record<string, never>
		) => Promise<{ id: Id<'grandPrix'>; order: number } | null>;
	}
)._handler;

type Row = Record<string, unknown>;
function context(rows: Record<string, Row[]>) {
	return {
		db: {
			query(table: string) {
				let selected = [...(rows[table] ?? [])];
				const query = {
					withIndex(_index: string, select?: (q: unknown) => unknown) {
						select?.({
							eq(field: string, value: unknown) {
								selected = selected.filter((row) => row[field] === value);
								return this;
							}
						});
						return query;
					},
					order() {
						selected.sort((a, b) => Number(b.order) - Number(a.order));
						return query;
					},
					async collect() {
						return selected;
					},
					async *[Symbol.asyncIterator]() {
						yield* selected;
					}
				};
				return query;
			}
		}
	} as unknown as QueryCtx;
}

test('latest completed finds older history beyond 12 unfinished GPs and excludes deletions', async () => {
	const rows = {
		grandPrix: [
			...Array.from({ length: 14 }, (_, i) => ({
				_id: `unfinished${i}`,
				order: i + 3,
				participants: ['a']
			})),
			{ _id: 'deleted', order: 20, participants: ['a'], completedAt: 1, deletedAt: 2 },
			{ _id: 'complete', order: 2, participants: ['a', 'b'] }
		],
		races: [{ _id: 'race', grandPrixId: 'complete' }],
		results: [
			{ raceId: 'race', userId: 'a', position: 1 },
			{ raceId: 'race', userId: 'b', position: 2 }
		]
	};
	assert.deepEqual(await handler(context(rows), {}), { id: 'complete', order: 2 });
});

test('manual completion allows missing finishes but still requires racers and scheduled races', async () => {
	const rows = {
		grandPrix: [
			{ _id: 'no-racers', order: 5, participants: [], completedAt: 1 },
			{ _id: 'no-races', order: 4, participants: ['a'], completedAt: 1 },
			{ _id: 'partial', order: 3, participants: ['a', 'b'] },
			{ _id: 'manual', order: 2, participants: ['a', 'b'], completedAt: 1 }
		],
		races: [
			{ _id: 'r1', grandPrixId: 'partial' },
			{ _id: 'r2', grandPrixId: 'manual' }
		],
		results: [{ raceId: 'r1', userId: 'a', position: 1 }]
	};
	assert.deepEqual(await handler(context(rows), {}), { id: 'manual', order: 2 });
	assert.equal(await handler(context({ grandPrix: [] }), {}), null);
});
