import { isValidFinishPosition } from './grand-prix';
import { placementToPoints } from './utils';

export type ProgressFinish = { trackEndId: string; position: number };
export type ProgressGp = {
	id: string;
	order: number;
	createdAt: number;
	finishes: ProgressFinish[];
};
export const progressSizes = [1, 5, 10, 20] as const;
export type ProgressSize = (typeof progressSizes)[number];

export function parseProgressPeriod(params: URLSearchParams) {
	const size = Number(params.get('progressSize'));
	const rawEnd = params.get('progressThrough');
	const end = rawEnd ? Number(rawEnd) : NaN;
	return {
		size: (progressSizes.includes(size as ProgressSize) ? size : 10) as ProgressSize,
		through: Number.isSafeInteger(end) && end >= 1 ? end : undefined
	};
}

export function summarizeFinishes(finishes: readonly ProgressFinish[]) {
	const valid = finishes.filter((finish) => isValidFinishPosition(finish.position));
	const count = valid.length;
	return {
		count,
		average: count ? valid.reduce((sum, f) => sum + f.position, 0) / count : null,
		wins: valid.filter((f) => f.position === 1).length,
		winRate: count ? valid.filter((f) => f.position === 1).length / count : null,
		points: count ? valid.reduce((sum, f) => sum + placementToPoints[f.position], 0) / count : null
	};
}

/** Nonoverlapping GP windows; never fill the previous period by moving recent GPs into it. */
export function buildPersonalProgress(gps: readonly ProgressGp[], size: ProgressSize) {
	const eligible = gps
		.map((gp) => ({
			...gp,
			finishes: gp.finishes.filter((f) => isValidFinishPosition(f.position))
		}))
		.filter((gp) => gp.finishes.length)
		.sort((a, b) => b.order - a.order || b.createdAt - a.createdAt || b.id.localeCompare(a.id))
		.slice(0, size * 2);
	const recentGps = eligible.slice(0, size);
	const previousGps = eligible.slice(size);
	const recent = recentGps.flatMap((gp) => gp.finishes);
	const previous = previousGps.flatMap((gp) => gp.finishes);
	const trackIds = [...new Set([...recent, ...previous].map((f) => f.trackEndId))];
	const tracks = trackIds.map((trackEndId) => {
		const r = summarizeFinishes(recent.filter((f) => f.trackEndId === trackEndId));
		const p = summarizeFinishes(previous.filter((f) => f.trackEndId === trackEndId));
		return {
			trackEndId,
			recent: r,
			previous: p,
			delta: r.average !== null && p.average !== null ? r.average - p.average : null
		};
	});
	const shared = tracks.filter((t) => t.delta !== null);
	// Equal weight per shared track in both periods removes changes in track frequency.
	const sharedRecent = shared.length
		? shared.reduce((s, t) => s + t.recent.average!, 0) / shared.length
		: null;
	const sharedPrevious = shared.length
		? shared.reduce((s, t) => s + t.previous.average!, 0) / shared.length
		: null;
	return {
		recent: { gps: recentGps, ...summarizeFinishes(recent) },
		previous: { gps: previousGps, ...summarizeFinishes(previous) },
		tracks,
		shared: {
			count: shared.length,
			recent: sharedRecent,
			previous: sharedPrevious,
			delta:
				sharedRecent !== null && sharedPrevious !== null ? sharedRecent - sharedPrevious : null,
			recentCount: shared.reduce((s, t) => s + t.recent.count, 0),
			previousCount: shared.reduce((s, t) => s + t.previous.count, 0)
		},
		trend: [...eligible].reverse().map((gp) => ({
			...gp,
			...summarizeFinishes(gp.finishes),
			period: recentGps.some((r) => r.id === gp.id) ? 'Recent' : 'Previous'
		}))
	};
}
