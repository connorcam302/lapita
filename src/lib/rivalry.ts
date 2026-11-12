import { isValidFinishPosition } from './grand-prix';
import { placementToPoints } from './utils';
import type { Id } from '../convex/_generated/dataModel';

export const rivalryScopes = ['all', '5', '10', '20'] as const;
export type RivalryScope = (typeof rivalryScopes)[number];
export function parseRivalryScope(value: string | null): RivalryScope {
	return rivalryScopes.find((scope) => scope === value) ?? 'all';
}

export type RivalryRace = {
	raceId: Id<'races'>;
	grandPrixId: Id<'grandPrix'>;
	gpOrder: number;
	raceOrder: number;
	trackId: Id<'tracks'>;
	aPosition?: number | null;
	bPosition?: number | null;
};

/** All metrics use exactly the same paired sample. Ties award no head-to-head wins. */
export function summarizeRivalry(input: readonly RivalryRace[]) {
	const races = input
		.filter(
			(race) => isValidFinishPosition(race.aPosition) && isValidFinishPosition(race.bPosition)
		)
		.map((race) => ({ ...race, aPosition: race.aPosition!, bPosition: race.bPosition! }))
		.sort(
			(a, b) =>
				a.gpOrder - b.gpOrder || a.raceOrder - b.raceOrder || a.raceId.localeCompare(b.raceId)
		);
	function summary(rows: typeof races) {
		const count = rows.length;
		const aAhead = rows.filter((r) => r.aPosition < r.bPosition).length;
		const bAhead = rows.filter((r) => r.bPosition < r.aPosition).length;
		return {
			count,
			aAhead,
			bAhead,
			ties: count - aAhead - bAhead,
			aPercent: count ? (aAhead / count) * 100 : null,
			bPercent: count ? (bAhead / count) * 100 : null,
			aAverage: count ? rows.reduce((sum, r) => sum + r.aPosition, 0) / count : null,
			bAverage: count ? rows.reduce((sum, r) => sum + r.bPosition, 0) / count : null,
			aPoints: rows.reduce((sum, r) => sum + placementToPoints[r.aPosition], 0),
			bPoints: rows.reduce((sum, r) => sum + placementToPoints[r.bPosition], 0)
		};
	}
	const groups = new Map<Id<'tracks'>, typeof races>();
	let a = 0,
		b = 0;
	const timeline = races.map((race, index) => {
		if (race.aPosition < race.bPosition) a++;
		if (race.bPosition < race.aPosition) b++;
		const group = groups.get(race.trackId) ?? [];
		group.push(race);
		groups.set(race.trackId, group);
		return { ...race, raceNumber: index + 1, a, b };
	});
	return {
		...summary(races),
		races,
		timeline,
		tracks: [...groups]
			.map(([trackId, rows]) => ({ trackId, ...summary(rows) }))
			.sort((a, b) => b.count - a.count || a.trackId.localeCompare(b.trackId))
	};
}
