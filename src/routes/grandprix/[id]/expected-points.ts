import { placementToPoints } from '$lib/utils';

type Race = {
	trackEndId: string;
	results: { userId: string; position?: number | null }[];
};
type TrackChances = {
	trackId: string;
	chances?: { user: { userId: string }; chance: number }[];
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
			(chancesByTrack.get(race.trackEndId) ?? []).map(({ user, chance }) => [user.userId, chance])
		);
		// Without every remaining racer's probability, their relative places are unknown.
		if (pending.some((id) => !Number.isFinite(chances.get(id)))) {
			for (const id of pending) totals.set(id, null);
			continue;
		}

		pending.sort((a, b) => chances.get(b)! - chances.get(a)!);
		const available = Array.from({ length: 24 }, (_, i) => i + 1).filter(
			(position) => !occupied.has(position)
		);
		for (let start = 0; start < pending.length;) {
			let end = start + 1;
			while (end < pending.length && chances.get(pending[end]) === chances.get(pending[start]))
				end++;
			const points =
				available
					.slice(start, end)
					.reduce((sum, position) => sum + placementToPoints[position], 0) /
				(end - start);
			for (let i = start; i < end; i++) add(pending[i], points);
			start = end;
		}
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
