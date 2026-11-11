import type { Doc } from '../convex/_generated/dataModel';

export type TrackRace = Doc<'races'> & {
	grandPrixOrder: number | null;
	participants: Doc<'grandPrix'>['participants'];
	results: Doc<'results'>[];
};

export function validPosition(position: number | null | undefined): position is number {
	return (
		typeof position === 'number' && Number.isInteger(position) && position >= 1 && position <= 24
	);
}

export function summarizePositions(positions: number[]) {
	const count = positions.length;
	const average = count ? positions.reduce((sum, position) => sum + position, 0) / count : null;
	return {
		count,
		average,
		best: count ? Math.min(...positions) : null,
		worst: count ? Math.max(...positions) : null,
		wins: positions.filter((position) => position === 1).length,
		podiums: positions.filter((position) => position <= 3).length,
		consistency:
			average === null
				? null
				: Math.sqrt(positions.reduce((sum, position) => sum + (position - average) ** 2, 0) / count)
	};
}

export function summarizeTrack(races: TrackRace[]) {
	const finished = races.flatMap((race) =>
		race.results.filter((result) => validPosition(result.position))
	);
	const players = new Map<string, number[]>();
	const combos = new Map<
		string,
		{
			characterId: NonNullable<Doc<'results'>['characterId']>;
			kartId: NonNullable<Doc<'results'>['kartId']>;
			positions: number[];
		}
	>();
	for (const result of finished) {
		players.set(result.userId, [...(players.get(result.userId) ?? []), result.position!]);
		if (result.characterId && result.kartId) {
			const key = `${result.characterId}|${result.kartId}`;
			const combo = combos.get(key) ?? {
				characterId: result.characterId,
				kartId: result.kartId,
				positions: []
			};
			combo.positions.push(result.position!);
			combos.set(key, combo);
		}
	}
	return {
		...summarizePositions(finished.map((result) => result.position!)),
		averageParticipants: races.length ? finished.length / races.length : null,
		players: [...players]
			.map(([userId, positions]) => ({
				userId,
				...summarizePositions(positions),
				recentAverage: summarizePositions(positions.slice(0, 5)).average
			}))
			.sort(
				(a, b) => a.average! - b.average! || b.count - a.count || a.userId.localeCompare(b.userId)
			),
		combinations: [...combos.values()]
			.map((combo) => ({ ...combo, ...summarizePositions(combo.positions) }))
			.sort((a, b) => b.count - a.count || a.average! - b.average!),
		distribution: Array.from({ length: 24 }, (_, index) => ({
			position: index + 1,
			count: finished.filter((result) => result.position === index + 1).length
		}))
	};
}
