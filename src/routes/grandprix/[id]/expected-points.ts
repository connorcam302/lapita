import { placementToPoints } from '$lib/utils';

type Race = {
	trackEndId: string;
	results: { userId: string; position?: number | null }[];
};
type TrackChances = {
	trackId: string;
	chances?: {
		user: {
			userId: string;
			finalWeight?: number;
			average?: number;
			lastFiveResults?: readonly (number | null | undefined)[];
			bestResult?: number | null;
			count?: number;
		};
		chance: number;
	}[];
};

/** Project final GP points, replacing predictions with recorded finishes as they arrive. */
export function calculateExpectedPoints(
	participants: readonly string[],
	races: readonly Race[],
	stats: readonly TrackChances[]
): Map<string, number | null> {
	const totals = new Map<string, number | null>(participants.map((id) => [id, 0]));
	const chancesByTrack = new Map(stats.map((stat) => [stat.trackId, stat.chances]));

	for (const race of races) {
		const occupied = new Set<number>();
		const pending: string[] = [];
		const add = (id: string, points: number) => {
			const total = totals.get(id);
			if (total != null) totals.set(id, total + points);
		};

		for (const id of participants) {
			const position = race.results.find((result) => result.userId === id)?.position;
			if (
				typeof position === 'number' &&
				Number.isInteger(position) &&
				position >= 1 &&
				position <= 24
			) {
				occupied.add(position);
				add(id, placementToPoints[position]);
			} else {
				pending.push(id);
			}
		}

		const chances = new Map(
			(chancesByTrack.get(race.trackEndId) ?? []).map(({ user, chance }) => [
				user.userId,
				{ user, chance }
			])
		);
		// Without every remaining racer's probability, their relative places are unknown.
		if (pending.some((id) => !Number.isFinite(chances.get(id)?.chance))) {
			for (const id of pending) totals.set(id, null);
			continue;
		}

		const metric = (value: number | null | undefined, fallback: number) =>
			typeof value === 'number' && Number.isFinite(value) ? value : fallback;
		const recentAverage = (user: NonNullable<TrackChances['chances']>[number]['user']) => {
			const finishes = (user.lastFiveResults ?? []).filter(
				(value): value is number =>
					typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 24
			);
			return finishes.length
				? finishes.reduce((sum, value) => sum + value, 0) / finishes.length
				: Infinity;
		};
		pending.sort((a, b) => {
			const first = chances.get(a)!;
			const second = chances.get(b)!;
			// Resolve rounded probability ties with the underlying model and track history.
			// Missing secondary metrics sort after known values; exact ties use a stable ID order.
			return first.chance === second.chance
				? metric(second.user.finalWeight, -Infinity) - metric(first.user.finalWeight, -Infinity) ||
						metric(first.user.average, Infinity) - metric(second.user.average, Infinity) ||
						recentAverage(first.user) - recentAverage(second.user) ||
						metric(first.user.bestResult, Infinity) - metric(second.user.bestResult, Infinity) ||
						metric(second.user.count, -Infinity) - metric(first.user.count, -Infinity) ||
						a.localeCompare(b)
				: second.chance - first.chance;
		});
		const available = Array.from({ length: 24 }, (_, i) => i + 1).filter(
			(position) => !occupied.has(position)
		);
		pending.forEach((id, index) => add(id, placementToPoints[available[index]]));
	}

	return totals;
}

/** Compare recorded finishes with probability-ranked points for those same races. */
export function calculatePointsComparison<UserId extends string>(
	participants: readonly UserId[],
	races: readonly Race[],
	stats: readonly TrackChances[]
) {
	const predictions = races.map((race) =>
		calculateExpectedPoints(participants, [{ ...race, results: [] }], stats)
	);

	return participants.map((userId) => {
		let actual = 0;
		let expected: number | null = 0;
		let recordedRaces = 0;
		for (const [index, race] of races.entries()) {
			const position = race.results.find((result) => result.userId === userId)?.position;
			if (
				typeof position !== 'number' ||
				!Number.isInteger(position) ||
				position < 1 ||
				position > 24
			)
				continue;
			recordedRaces++;
			actual += placementToPoints[position];
			const predicted = predictions[index].get(userId);
			expected = expected == null || predicted == null ? null : expected + predicted;
		}
		return {
			userId,
			recordedRaces,
			actual,
			expected: recordedRaces ? expected : null,
			difference: recordedRaces && expected != null ? actual - expected : null
		};
	});
}

/** Reconstructed pre-GP expectations for the Driver of the Day award. */
export function calculateAwardComparisons(
	participants: readonly string[],
	races: readonly Race[],
	stats: readonly TrackChances[]
) {
	const byTrack = new Map(stats.map((stat) => [stat.trackId, stat.chances]));
	return calculatePointsComparison(participants, races, stats).map((comparison) => {
		let expectedWins: number | null = 0;
		for (const race of races) {
			const chances = byTrack.get(race.trackEndId);
			// Compare the same full field on every scheduled race, never treat missing chances as zero.
			if (
				participants.some((id) => {
					const chance = chances?.find(({ user }) => user.userId === id)?.chance;
					return chance == null || !Number.isFinite(chance) || chance < 0 || chance > 100;
				})
			) {
				expectedWins = null;
				break;
			}
			expectedWins += chances!.find(({ user }) => user.userId === comparison.userId)!.chance / 100;
		}
		return { ...comparison, expectedWins: races.length ? expectedWins : null };
	});
}
