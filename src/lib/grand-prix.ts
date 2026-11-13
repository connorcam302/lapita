import { placementToPoints } from './utils';

/** Only integer finishes in the game's 24-place field can earn points. */
export function isValidFinishPosition(position: unknown): position is number {
	return (
		typeof position === 'number' && Number.isInteger(position) && position >= 1 && position <= 24
	);
}

/** A race is complete only when every participant has a valid finishing position. */
export function hasAllResults(
	participants: readonly string[],
	results: readonly { userId: string; position?: number | null }[]
) {
	return (
		participants.length > 0 &&
		participants.every((userId) =>
			results.some((result) => result.userId === userId && isValidFinishPosition(result.position))
		)
	);
}

/** Manual completion ends the GP using recorded points; missing finishes earn zero. */
export function summarizeGrandPrix<UserId extends string>(
	participants: readonly UserId[],
	races: readonly { results: readonly { userId: string; position?: number | null }[] }[],
	completedAt?: number,
	knockoutWinnerId?: UserId
) {
	const scores = new Map(participants.map((id) => [id, 0]));
	for (const race of races) {
		for (const id of participants) {
			const position = race.results.find((result) => result.userId === id)?.position;
			if (isValidFinishPosition(position)) {
				scores.set(id, scores.get(id)! + placementToPoints[position]);
			}
		}
	}
	const complete =
		participants.length > 0 &&
		races.length > 0 &&
		(completedAt !== undefined || races.every((race) => hasAllResults(participants, race.results)));
	const highest = Math.max(...scores.values());
	const tiedLeaderIds = complete ? participants.filter((id) => scores.get(id) === highest) : [];
	const winner =
		tiedLeaderIds.length > 1 && knockoutWinnerId && tiedLeaderIds.includes(knockoutWinnerId)
			? knockoutWinnerId
			: undefined;
	return {
		scores,
		complete,
		tiedLeaderIds,
		knockoutWinnerId: winner,
		winnerIds: winner ? [winner] : tiedLeaderIds,
		standings: rankGrandPrixStandings(
			participants.map((userId) => ({ userId, points: scores.get(userId)! })),
			winner
		)
	};
}

/** Knockout breaks only the first-place tie. Race points and all other ties stay intact. */
export function rankGrandPrixStandings<T extends { userId: string; points: number }>(
	standings: readonly T[],
	knockoutWinnerId?: string
) {
	const highest = Math.max(...standings.map((standing) => standing.points));
	const winner = standings.find(
		(standing) => standing.userId === knockoutWinnerId && standing.points === highest
	);
	const sorted = [...standings].sort(
		(a, b) =>
			b.points - a.points ||
			Number(b === winner) - Number(a === winner) ||
			a.userId.localeCompare(b.userId)
	);
	return sorted.map((standing) => ({
		...standing,
		position:
			1 +
			sorted.filter(
				(other) =>
					other.points > standing.points ||
					(other === winner && standing !== winner && other.points === standing.points)
			).length
	}));
}
