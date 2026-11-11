import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type PlayerResult = FunctionReturnType<typeof api.results.getPlayer>[number];
type Standing = FunctionReturnType<typeof api.gps.getPlayerResults>[number];
export type FinishedResult = PlayerResult & {
	position: number;
	trackStartId: Id<'tracks'>;
	trackEndId: Id<'tracks'>;
	grandPrixId: Id<'grandPrix'>;
};
export type TrackSummary = {
	trackEndId: Id<'tracks'>;
	positions: number[];
	average: number;
	recentAverage: number;
};

export const average = (values: number[]) =>
	values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function summarizePlayer(results: PlayerResult[], standings: Standing[]) {
	const validResults = results.filter(
		(result): result is FinishedResult =>
			!!result.trackStartId &&
			!!result.trackEndId &&
			!!result.grandPrixId &&
			Number.isInteger(result.position) &&
			result.position! >= 1 &&
			result.position! <= 24
	);
	const finished = [...validResults].sort(
		(a, b) => b.grandPrixOrder - a.grandPrixOrder || b._creationTime - a._creationTime
	);
	const tracks = new Map<Id<'tracks'>, number[]>();
	const combinations = new Map<
		string,
		{
			characterId: Id<'characters'>;
			kartId: Id<'karts'>;
			results: FinishedResult[];
			gpPoints: number[];
			gpWins: number;
		}
	>();
	for (const result of finished) {
		tracks.set(result.trackEndId, [...(tracks.get(result.trackEndId) ?? []), result.position]);
	}
	// Retain query order for tied combination and track rankings.
	for (const result of validResults) {
		if (!result.characterId || !result.kartId) continue;
		const key = `${result.characterId}|${result.kartId}`;
		const combo = combinations.get(key) ?? {
			characterId: result.characterId,
			kartId: result.kartId,
			results: [],
			gpPoints: [],
			gpWins: 0
		};
		combo.results.push(result);
		combinations.set(key, combo);
	}
	// A GP belongs to its most-used combination, matching the existing profile calculation.
	for (const standing of standings) {
		const counts = new Map<string, number>();
		for (const result of validResults.filter((race) => race.grandPrixId === standing.grandPrixId)) {
			if (!result.characterId || !result.kartId) continue;
			const key = `${result.characterId}|${result.kartId}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		const key = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
		const combo = key ? combinations.get(key) : undefined;
		if (combo) {
			if (standing.points != null) combo.gpPoints.push(standing.points);
			if (standing.position === 1) combo.gpWins++;
		}
	}
	return {
		finished,
		average: average(finished.map((result) => result.position)),
		tracks: [...tracks]
			.map(([trackEndId, positions]): TrackSummary => ({
				trackEndId,
				positions,
				average: average(positions)!,
				recentAverage: average(positions.slice(0, 10))!
			}))
			.sort((a, b) => a.average - b.average),
		combinations: [...combinations.values()]
			.map((combo) => {
				const trackPositions = new Map<Id<'tracks'>, number[]>();
				for (const result of combo.results) {
					trackPositions.set(result.trackStartId, [
						...(trackPositions.get(result.trackStartId) ?? []),
						result.position
					]);
				}
				const ranked = [...trackPositions].sort((a, b) => average(a[1])! - average(b[1])!);
				return {
					...combo,
					raceCount: combo.results.length,
					averagePlacement: average(combo.results.map((result) => result.position))!,
					averageGpPoints: average(combo.gpPoints),
					bestTrack: ranked[0][0],
					worstTrack: ranked.at(-1)![0]
				};
			})
			.sort((a, b) => b.raceCount - a.raceCount)
	};
}
