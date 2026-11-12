import type { Doc } from '../convex/_generated/dataModel';
import { hasAllResults, summarizeGrandPrix } from './grand-prix';
import { placementToPoints } from './utils';

type Gp = Pick<
	Doc<'grandPrix'>,
	'_id' | '_creationTime' | 'order' | 'participants' | 'deletedAt' | 'completedAt' | 'era'
>;
type Race = Pick<Doc<'races'>, '_id' | 'grandPrixId' | 'order' | 'trackEndId'>;
type Result = Pick<Doc<'results'>, 'raceId' | 'userId' | 'position' | 'characterId' | 'kartId'>;

/** Shared with Records: only fully recorded participant races count toward race stats. */
export function calculateStats(
	users: Pick<Doc<'users'>, '_id' | 'name'>[],
	gps: Gp[],
	races: Race[],
	results: Result[],
	tracks: Pick<Doc<'tracks'>, '_id' | 'name'>[],
	characters: Pick<Doc<'characters'>, '_id' | 'name'>[],
	karts: Pick<Doc<'karts'>, '_id' | 'name'>[]
) {
	const players = users.map((user) => ({
		userId: user._id,
		name: user.name,
		races: 0,
		wins: 0,
		podiums: 0,
		gpEntries: 0,
		gpWins: 0,
		points: 0,
		positionSum: 0,
		finishes: Array<number>(24).fill(0)
	}));
	const playerById = new Map(players.map((player) => [player.userId, player]));
	const resultsByRace = new Map<string, Result[]>();
	for (const result of results) {
		const entries = resultsByRace.get(result.raceId) ?? [];
		entries.push(result);
		resultsByRace.set(result.raceId, entries);
	}
	const racesByGp = new Map<string, Race[]>();
	for (const race of races) {
		const entries = racesByGp.get(race.grandPrixId) ?? [];
		entries.push(race);
		racesByGp.set(race.grandPrixId, entries);
	}
	const trackCounts = new Map<string, number>();
	const combos = new Map<string, { name: string; count: number; wins: number }>();
	const characterNames = new Map(
		characters.map((item) => [item._id, item.name ?? 'Unknown character'])
	);
	const kartNames = new Map(karts.map((item) => [item._id, item.name]));
	const timeline: {
		grandPrixId: Gp['_id'];
		order: number;
		date: number;
		era?: string;
		races: number;
		gpWins: Record<string, number>;
		raceWins: Record<string, number>;
	}[] = [];
	let completedGps = 0;
	let completedRaces = 0;
	const activeGps = gps
		.filter((gp) => gp.deletedAt === undefined)
		.sort((a, b) => a.order - b.order || a._id.localeCompare(b._id));
	for (const gp of activeGps) {
		const gpRaces = [...(racesByGp.get(gp._id) ?? [])].sort((a, b) => a.order - b.order);
		const summary = summarizeGrandPrix(
			gp.participants,
			gpRaces.map((race) => ({ results: resultsByRace.get(race._id) ?? [] })),
			gp.completedAt
		);
		let raceCount = 0;
		for (const race of gpRaces) {
			const entries = resultsByRace.get(race._id) ?? [];
			if (!hasAllResults(gp.participants, entries)) continue;
			raceCount++;
			completedRaces++;
			trackCounts.set(race.trackEndId, (trackCounts.get(race.trackEndId) ?? 0) + 1);
			for (const userId of gp.participants) {
				const entry = entries.find((result) => result.userId === userId)!;
				const position = entry.position!;
				const player = playerById.get(userId);
				if (!player) continue;
				player.races++;
				player.positionSum += position;
				player.points += placementToPoints[position];
				player.finishes[position - 1]++;
				if (position === 1) player.wins++;
				if (position <= 3) player.podiums++;
				if (entry.characterId && entry.kartId) {
					const key = `${entry.characterId}:${entry.kartId}`;
					const combo = combos.get(key) ?? {
						name: `${characterNames.get(entry.characterId) ?? 'Unknown character'} / ${kartNames.get(entry.kartId) ?? 'Unknown kart'}`,
						count: 0,
						wins: 0
					};
					combo.count++;
					if (position === 1) combo.wins++;
					combos.set(key, combo);
				}
			}
		}
		if (summary.complete) {
			completedGps++;
			for (const id of gp.participants) {
				const player = playerById.get(id);
				if (player) player.gpEntries++;
			}
			for (const id of summary.winnerIds) {
				const player = playerById.get(id);
				if (player) player.gpWins++;
			}
		}
		timeline.push({
			grandPrixId: gp._id,
			order: gp.order,
			date: gp._creationTime,
			era: gp.era,
			races: raceCount,
			gpWins: Object.fromEntries(players.map((p) => [p.userId, p.gpWins])),
			raceWins: Object.fromEntries(players.map((p) => [p.userId, p.wins]))
		});
	}
	return {
		completedGps,
		completedRaces,
		totalGps: activeGps.length,
		players: players.map((p) => ({
			...p,
			average: p.races ? p.positionSum / p.races : null,
			winRate: p.races ? (p.wins / p.races) * 100 : 0,
			podiumRate: p.races ? (p.podiums / p.races) * 100 : 0
		})),
		timeline,
		tracks: tracks
			.map((track) => ({
				trackId: track._id,
				name: track.name,
				count: trackCounts.get(track._id) ?? 0
			}))
			.filter((track) => track.count > 0)
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
		combos: [...combos.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
	};
}
