import { isValidFinishPosition } from './grand-prix';

const FULL_WEIGHT_FINISHES = 10;
const OLDER_FINISH_DECAY = 0.9;

type HistoricalFinish<UserId extends string> = {
	userId: UserId;
	position?: number | null;
	grandPrixOrder: number;
	raceOrder: number;
	createdAt: number;
	id: string;
};

/** Latest ten valid track finishes count equally; every older finish loses another 10%. */
export function recencyWeightedAverage(
	finishesNewestFirst: readonly (number | null | undefined)[]
) {
	const finishes = finishesNewestFirst.filter(isValidFinishPosition);
	if (!finishes.length) return null;
	let points = 0;
	let totalWeight = 0;
	for (const [index, finish] of finishes.entries()) {
		const weight = OLDER_FINISH_DECAY ** Math.max(0, index - FULL_WEIGHT_FINISHES + 1);
		points += finish * weight;
		totalWeight += weight;
	}
	return points / totalWeight;
}

/** Order by the race's place in history, so backfilled results do not become recent form. */
export function buildTrackForecastStats<UserId extends string>(
	history: readonly HistoricalFinish<UserId>[]
) {
	const ordered = [...history].sort(
		(a, b) =>
			a.grandPrixOrder - b.grandPrixOrder ||
			a.raceOrder - b.raceOrder ||
			a.createdAt - b.createdAt ||
			a.id.localeCompare(b.id)
	);
	const byUser = new Map<UserId, number[]>();
	for (const result of ordered) {
		if (!isValidFinishPosition(result.position)) continue;
		const finishes = byUser.get(result.userId) ?? [];
		finishes.push(result.position);
		byUser.set(result.userId, finishes);
	}
	return [...byUser].map(([userId, finishes]) => ({
		userId,
		avg: finishes.reduce((sum, finish) => sum + finish, 0) / finishes.length,
		weightedAvg: recencyWeightedAverage(finishes.toReversed())!,
		count: finishes.length,
		lastFiveResults: finishes.slice(-5),
		bestResult: finishes.reduce((best, finish) => Math.min(best, finish), 24)
	}));
}

/** Fill track-history gaps without excluding racers from the probability model. */
export function fillTrackForecastStats<UserId extends string>(
	users: readonly UserId[],
	trackStats: ReturnType<typeof buildTrackForecastStats<UserId>>,
	overallStats: ReturnType<typeof buildTrackForecastStats<UserId>>
) {
	return users.map(
		(userId) =>
			trackStats.find((stat) => stat.userId === userId) ??
			overallStats.find((stat) => stat.userId === userId) ?? {
				userId,
				avg: 12.5,
				weightedAvg: 12.5,
				count: 0,
				lastFiveResults: [],
				bestResult: 12.5
			}
	);
}
