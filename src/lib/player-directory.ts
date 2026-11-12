import type { Doc, Id } from '../convex/_generated/dataModel';
import { isValidFinishPosition, summarizeGrandPrix } from './grand-prix';

type User = Pick<Doc<'users'>, '_id' | 'name'>;
type Gp = Pick<Doc<'grandPrix'>, '_id' | 'participants' | 'deletedAt' | 'completedAt'>;
type Race = Pick<Doc<'races'>, '_id' | 'grandPrixId'>;
type Result = Pick<Doc<'results'>, 'raceId' | 'userId' | 'position' | 'characterId' | 'kartId'>;

/** Recorded finishes include partial races; GP wins use shared completion rules. */
export function aggregatePlayerDirectory(
	users: User[],
	gps: Gp[],
	races: Race[],
	results: Result[]
) {
	const activeGps = new Map(
		gps.filter((gp) => gp.deletedAt === undefined).map((gp) => [gp._id, gp])
	);
	const activeRaces = new Map(
		races.filter((race) => activeGps.has(race.grandPrixId)).map((race) => [race._id, race])
	);
	const resultsByRace = new Map<Id<'races'>, Result[]>();
	const players = new Map(
		users.map((user) => [
			user._id,
			{
				userId: user._id,
				name: user.name,
				raceCount: 0,
				raceWins: 0,
				gpWins: 0,
				positionSum: 0,
				characters: new Map<Id<'characters'>, number>(),
				karts: new Map<Id<'karts'>, number>()
			}
		])
	);
	for (const result of results) {
		const race = activeRaces.get(result.raceId);
		if (!race) continue;
		const entries = resultsByRace.get(race._id) ?? [];
		entries.push(result);
		resultsByRace.set(race._id, entries);
		const player = players.get(result.userId);
		if (
			!player ||
			!activeGps.get(race.grandPrixId)!.participants.includes(result.userId) ||
			!isValidFinishPosition(result.position)
		)
			continue;
		player.raceCount++;
		player.raceWins += Number(result.position === 1);
		player.positionSum += result.position;
		if (result.characterId)
			player.characters.set(
				result.characterId,
				(player.characters.get(result.characterId) ?? 0) + 1
			);
		if (result.kartId) player.karts.set(result.kartId, (player.karts.get(result.kartId) ?? 0) + 1);
	}
	const racesByGp = new Map<Id<'grandPrix'>, { results: Result[] }[]>();
	for (const race of activeRaces.values()) {
		const entries = racesByGp.get(race.grandPrixId) ?? [];
		entries.push({ results: resultsByRace.get(race._id) ?? [] });
		racesByGp.set(race.grandPrixId, entries);
	}
	for (const gp of activeGps.values()) {
		const { winnerIds } = summarizeGrandPrix(
			gp.participants,
			racesByGp.get(gp._id) ?? [],
			gp.completedAt
		);
		for (const id of winnerIds) {
			const player = players.get(id);
			if (player) player.gpWins++;
		}
	}
	function mostUsed<T extends string>(counts: Map<T, number>): T | null {
		return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
	}
	return [...players.values()].map((player) => ({
		userId: player.userId,
		name: player.name,
		raceCount: player.raceCount,
		raceWins: player.raceWins,
		gpWins: player.gpWins,
		averageFinish: player.raceCount ? player.positionSum / player.raceCount : null,
		characterId: mostUsed(player.characters),
		kartId: mostUsed(player.karts)
	}));
}

export type DirectoryPlayer = ReturnType<typeof aggregatePlayerDirectory>[number];
export type DirectorySort = 'name' | 'raceCount' | 'raceWins' | 'gpWins' | 'averageFinish';

export function filterAndSortPlayers(
	players: DirectoryPlayer[],
	search: string,
	sort: DirectorySort,
	ascending: boolean
) {
	const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	return players
		.filter((player) => terms.every((term) => player.name.toLocaleLowerCase().includes(term)))
		.sort((a, b) => {
			const left = a[sort];
			const right = b[sort];
			// Unraced players always follow measured averages, in either direction.
			if (left === null || right === null)
				return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
			const difference =
				typeof left === 'string' && typeof right === 'string'
					? left.localeCompare(right)
					: Number(left) - Number(right);
			return (
				difference * (ascending ? 1 : -1) ||
				a.name.localeCompare(b.name) ||
				a.userId.localeCompare(b.userId)
			);
		});
}
