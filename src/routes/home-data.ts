export type Standing = { userId: string; points: number; position: number };
export type HistoryEntry = {
	grandPrixId: string;
	order: number;
	createdAt: number;
	standings: Standing[];
	raceCount: number;
	completedRaces: number;
	completedAt?: number;
};

export function isComplete(gp: Pick<HistoryEntry, 'raceCount' | 'completedRaces' | 'completedAt'>) {
	return gp.raceCount > 0 && (gp.completedAt !== undefined || gp.completedRaces === gp.raceCount);
}

export function getRaceContext<T extends { _id: string; order: number }>(
	races: readonly T[],
	currentRaceId: string | null,
	complete: boolean
): { previous: T | undefined; current: T | undefined } {
	const ordered = [...races].sort((a, b) => a.order - b.order);
	const index = complete
		? ordered.length - 1
		: ordered.findIndex((race) => race._id === currentRaceId);
	return { previous: index > 0 ? ordered[index - 1] : undefined, current: ordered[index] };
}
