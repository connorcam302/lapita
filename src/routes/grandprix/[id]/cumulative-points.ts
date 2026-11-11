import { placementToPoints } from '$lib/utils';

type Race = {
	order: number;
	results: readonly { userId: string; position?: number | null }[];
};

/** Running scores in race order, with cells always aligned to GP participants. */
export function calculateCumulativePoints<UserId extends string, RaceData extends Race>(
	participants: readonly UserId[],
	races: readonly RaceData[]
) {
	const totals = new Map(participants.map((userId) => [userId, 0]));
	return [...races]
		.sort((a, b) => a.order - b.order)
		.map((race) => {
			const cells = participants.map((userId) => {
				const recorded = race.results.find((result) => result.userId === userId)?.position;
				const position =
					typeof recorded === 'number' &&
					Number.isInteger(recorded) &&
					recorded >= 1 &&
					recorded <= 24
						? recorded
						: null;
				const total = totals.get(userId)! + (position == null ? 0 : placementToPoints[position]);
				totals.set(userId, total);
				return { userId, position, total };
			});
			return {
				...race,
				cells: cells.map((cell) => ({
					...cell,
					rank: 1 + cells.filter(({ total }) => total > cell.total).length
				}))
			};
		});
}
