import type { Doc } from '../convex/_generated/dataModel';
import { hasAllResults } from './grand-prix';

export function buildArchive(
	gps: Doc<'grandPrix'>[],
	races: Doc<'races'>[],
	results: Doc<'results'>[],
	standings: Doc<'grandPrixStandings'>[]
) {
	const racesByGp = Map.groupBy(races, (race) => race.grandPrixId);
	const resultsByRace = Map.groupBy(results, (result) => result.raceId);
	const standingsByGp = Map.groupBy(standings, (standing) => standing.grandPrixId);
	return gps.map((gp) => {
		const gpRaces = racesByGp.get(gp._id) ?? [];
		const completedRaces = gpRaces.filter((race) =>
			hasAllResults(gp.participants, resultsByRace.get(race._id) ?? [])
		).length;
		const complete = gpRaces.length > 0 && completedRaces === gpRaces.length;
		const ranked = (standingsByGp.get(gp._id) ?? [])
			.filter((standing) => gp.participants.includes(standing.userId))
			.sort((a, b) => b.points - a.points);
		return {
			grandPrixId: gp._id,
			order: gp.order,
			createdAt: gp._creationTime,
			participants: gp.participants,
			trackIds: [...new Set(gpRaces.flatMap((race) => [race.trackStartId, race.trackEndId]))],
			raceCount: gpRaces.length,
			completedRaces,
			status: complete ? 'complete' : 'in-progress',
			standings: ranked.map((standing) => ({
				userId: standing.userId,
				points: standing.points,
				position: ranked.findIndex((other) => other.points === standing.points) + 1
			})),
			winnerIds: complete
				? ranked.filter((standing) => standing.points === ranked[0]?.points).map((s) => s.userId)
				: []
		};
	});
}

export type ArchiveEntry = ReturnType<typeof buildArchive>[number];
export type ArchiveFilters = {
	q: string;
	status: string;
	player: string;
	winner: string;
	track: string;
	from: string;
	to: string;
	sort: string;
};

export function filterArchive(
	entries: ArchiveEntry[],
	filters: ArchiveFilters,
	players: readonly { _id: string; name: string }[]
) {
	const terms = filters.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
	const names = new Map(players.map((player) => [player._id, player.name]));
	return entries
		.filter((gp) => {
			const text =
				`grand prix gp ${gp.order} ${gp.participants.map((id) => names.get(id) ?? '').join(' ')}`.toLowerCase();
			// Local calendar dates match the date shown on the page, including the entire end day.
			const date = new Date(gp.createdAt);
			const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
			return (
				terms.every((term) => text.includes(term)) &&
				(!filters.status || gp.status === filters.status) &&
				(!filters.player || gp.participants.some((id) => id === filters.player)) &&
				(!filters.winner || gp.winnerIds.some((id) => id === filters.winner)) &&
				(!filters.track || gp.trackIds.some((id) => id === filters.track)) &&
				(!filters.from || day >= filters.from) &&
				(!filters.to || day <= filters.to)
			);
		})
		.sort((a, b) => (filters.sort === 'oldest' ? a.order - b.order : b.order - a.order));
}
