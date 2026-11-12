import { isValidFinishPosition } from './grand-prix';
import { placementToPoints } from './utils';

type Race = {
	_id: string;
	order: number;
	results: readonly { userId: string; position?: number | null }[];
};

/** Reconstruct only recorded scores, never forecasts or missing finishes. */
export function buildRecap(
	participantIds: readonly string[],
	races: readonly Race[],
	completedAt?: number
) {
	const participants = [...new Set(participantIds)];
	const totals = new Map(participants.map((id) => [id, 0]));
	const wins = new Map(participants.map((id) => [id, 0]));
	const recorded = new Map(participants.map((id) => [id, 0]));
	const rank = (points: number) => 1 + [...totals.values()].filter((n) => n > points).length;
	let missing = 0;
	const rows = [...races]
		.sort((a, b) => a.order - b.order || a._id.localeCompare(b._id))
		.map((race) => {
			const cells = participants.map((userId) => {
				const position = race.results.find((result) => result.userId === userId)?.position;
				const valid = isValidFinishPosition(position);
				if (valid) {
					totals.set(userId, totals.get(userId)! + placementToPoints[position]);
					recorded.set(userId, recorded.get(userId)! + 1);
					if (position === 1) wins.set(userId, wins.get(userId)! + 1);
				} else missing++;
				return { userId, total: totals.get(userId)!, recorded: valid };
			});
			return {
				raceId: race._id,
				order: race.order,
				cells: cells.map((cell) => ({ ...cell, rank: rank(cell.total) }))
			};
		});
	const complete =
		participants.length > 0 && races.length > 0 && (completedAt !== undefined || missing === 0);
	const fullHistory = participants.length > 0 && races.length > 0 && missing === 0;
	const standings = participants
		.map((userId) => ({
			userId,
			points: totals.get(userId)!,
			rank: rank(totals.get(userId)!),
			wins: wins.get(userId)!,
			recorded: recorded.get(userId)!
		}))
		.sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));
	const leaders = standings.filter((racer) => racer.rank === 1);
	const margin =
		leaders.length > 1
			? 0
			: standings.length > 1
				? standings[0].points - standings[1].points
				: null;
	const leadChanges: { afterRace: number; leaderIds: string[] }[] = [];
	if (fullHistory) {
		let previous = '';
		for (const [index, row] of rows.entries()) {
			const leaderIds = row.cells
				.filter((cell) => cell.rank === 1)
				.map((cell) => cell.userId)
				.sort();
			const key = JSON.stringify(leaderIds);
			if (index > 0 && key !== previous) leadChanges.push({ afterRace: row.order + 1, leaderIds });
			previous = key;
		}
	}
	const gains = fullHistory
		? standings.map((racer) => {
				const worstRank = Math.max(
					...rows.map((row) => row.cells.find((cell) => cell.userId === racer.userId)!.rank)
				);
				return {
					userId: racer.userId,
					worstRank,
					finalRank: racer.rank,
					gain: worstRank - racer.rank
				};
			})
		: [];
	const biggestGain = Math.max(0, ...gains.map((racer) => racer.gain));
	return {
		complete,
		fullHistory,
		missing,
		raceCount: races.length,
		standings,
		rows,
		margin,
		podium: standings.filter((racer) => racer.rank <= 3),
		leadChanges,
		comebacks: gains.filter((racer) => racer.gain === biggestGain && racer.gain > 0)
	};
}

export type Recap = ReturnType<typeof buildRecap>;

// Shared by the on-screen chart and the downloadable image. Dash patterns also identify racers.
export const recapColours = ['#2563eb', '#c2410c', '#15803d', '#a21caf', '#b45309', '#0891b2'];
export const recapDash = ['', '9 4', '3 4', '12 4 3 4'];
export function recapSeries(recap: Recap, userId: string) {
	// Once a score is missing, a cumulative trajectory is unknown. Never bridge the gap.
	let known = true;
	return [
		0,
		...recap.rows.map((row) => {
			const cell = row.cells.find((cell) => cell.userId === userId)!;
			known = known && cell.recorded;
			return known ? cell.total : null;
		})
	];
}

/** Gap to the actual cumulative leader; unknown for everyone after any missing finish. */
export function recapGapSeries(recap: Recap, userId: string) {
	let known = true;
	return [
		0,
		...recap.rows.map((row) => {
			known = known && row.cells.every((cell) => cell.recorded);
			if (!known) return null;
			const total = row.cells.find((cell) => cell.userId === userId)!.total;
			return Math.max(...row.cells.map((cell) => cell.total)) - total;
		})
	];
}
