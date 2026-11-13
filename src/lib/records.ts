import type { Doc, Id } from '../convex/_generated/dataModel';
import { hasAllResults, summarizeGrandPrix } from './grand-prix';

type Entry = {
	userId: Id<'users'>;
	name: string;
	value: number;
	raceCount: number;
	grandPrixId?: Id<'grandPrix'>;
	grandPrixOrder?: number;
	wonViaKnockout?: boolean;
};

export function calculateRecords(
	users: Pick<Doc<'users'>, '_id' | 'name'>[],
	gps: Pick<
		Doc<'grandPrix'>,
		'_id' | 'order' | 'participants' | 'completedAt' | 'knockoutWinnerId'
	>[],
	races: Pick<Doc<'races'>, '_id' | 'grandPrixId' | 'order'>[],
	results: Pick<Doc<'results'>, 'raceId' | 'userId' | 'position'>[]
) {
	const resultsByRace = new Map<string, typeof results>();
	for (const result of results) {
		const entries = resultsByRace.get(result.raceId) ?? [];
		entries.push(result);
		resultsByRace.set(result.raceId, entries);
	}
	const racesByGp = new Map<string, typeof races>();
	for (const race of races) {
		const entries = racesByGp.get(race.grandPrixId) ?? [];
		entries.push(race);
		racesByGp.set(race.grandPrixId, entries);
	}
	const players = new Map(
		users.map((user) => [
			user._id,
			{
				userId: user._id,
				name: user.name,
				raceCount: 0,
				wins: 0,
				podiums: 0,
				positionSum: 0,
				gpWins: 0,
				streak: 0,
				bestStreak: 0,
				bestScore: null as Entry | null
			}
		])
	);
	let completedRaces = 0;
	let completedGps = 0;
	for (const gp of [...gps].sort((a, b) => a.order - b.order || a._id.localeCompare(b._id))) {
		const gpRaces = [...(racesByGp.get(gp._id) ?? [])].sort((a, b) => a.order - b.order);
		const { complete, scores, winnerIds, knockoutWinnerId } = summarizeGrandPrix(
			gp.participants,
			gpRaces.map((race) => ({ results: resultsByRace.get(race._id) ?? [] })),
			gp.completedAt,
			gp.knockoutWinnerId
		);
		for (const race of gpRaces) {
			const entries = resultsByRace.get(race._id) ?? [];
			if (!hasAllResults(gp.participants, entries)) {
				// An unfinished race breaks a confirmed winning streak.
				for (const id of gp.participants) {
					const player = players.get(id);
					if (player) player.streak = 0;
				}
				continue;
			}
			completedRaces++;
			for (const id of gp.participants) {
				const position = entries.find((entry) => entry.userId === id)!.position!;
				const player = players.get(id);
				if (!player) continue;
				player.raceCount++;
				player.positionSum += position;
				if (position <= 3) player.podiums++;
				if (position === 1) player.wins++;
				player.streak = position === 1 ? player.streak + 1 : 0;
				player.bestStreak = Math.max(player.bestStreak, player.streak);
			}
		}
		if (!complete) continue;
		completedGps++;
		for (const [id, points] of scores) {
			const player = players.get(id);
			if (!player) continue;
			if (winnerIds.includes(id)) player.gpWins++;
			if (!player.bestScore || points > player.bestScore.value) {
				player.bestScore = {
					userId: id,
					name: player.name,
					value: points,
					raceCount: gpRaces.length,
					grandPrixId: gp._id,
					grandPrixOrder: gp.order,
					wonViaKnockout: knockoutWinnerId === id
				};
			}
		}
	}
	const all = [...players.values()];
	function rank(entries: Entry[], ascending = false) {
		const sorted = entries.sort(
			(a, b) => (ascending ? a.value - b.value : b.value - a.value) || a.name.localeCompare(b.name)
		);
		let position = 0;
		return sorted.map((entry, index) => {
			if (index === 0 || entry.value !== sorted[index - 1].value) position = index + 1;
			return { ...entry, rank: position };
		});
	}
	function count(key: 'wins' | 'podiums' | 'gpWins' | 'bestStreak') {
		return rank(
			all
				.filter((player) => player[key] > 0)
				.map((player) => ({
					userId: player.userId,
					name: player.name,
					value: player[key],
					raceCount: player.raceCount
				}))
		);
	}
	return {
		completedRaces,
		completedGps,
		raceWins: count('wins'),
		podiums: count('podiums'),
		gpWins: count('gpWins'),
		winStreak: count('bestStreak'),
		gpScore: rank(all.flatMap((player) => (player.bestScore ? [player.bestScore] : []))),
		average: rank(
			all
				.filter((player) => player.raceCount >= 10)
				.map((player) => ({
					userId: player.userId,
					name: player.name,
					value: player.positionSum / player.raceCount,
					raceCount: player.raceCount
				})),
			true
		)
	};
}
