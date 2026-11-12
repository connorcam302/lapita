import { placementToPoints } from '$lib/utils';
import { hasAllResults } from '$lib/grand-prix';
import { calculateExpectedPoints } from './expected-points';

type Race = Parameters<typeof calculateExpectedPoints>[1][number];
type TrackChances = Parameters<typeof calculateExpectedPoints>[2][number];
const SIMULATIONS = 5000;

/** Heuristic GP forecasts: keep recorded finishes and sample remaining group finish orders. */
export function calculateGpOutlook<UserId extends string>(
	participants: readonly UserId[],
	races: readonly Race[],
	stats: readonly TrackChances[],
	manuallyComplete = false
) {
	const projected = calculateExpectedPoints(participants, races, stats);
	const players = participants.map((userId) => ({
		userId,
		points: 0,
		minimum: 0,
		maximum: 0,
		remaining: 0,
		projected: projected.get(userId) ?? null,
		winChance: null as number | null,
		podiumChance: null as number | null
	}));
	const chances = new Map(
		stats.map((stat) => [
			stat.trackId,
			new Map((stat.chances ?? []).map(({ user, chance }) => [user.userId, chance]))
		])
	);
	const unfinished = races
		.map((race) => {
			const occupied = new Set<number>();
			const pending: { index: number; weight: number }[] = [];
			for (const [index, player] of players.entries()) {
				const position = race.results.find((result) => result.userId === player.userId)?.position;
				if (
					typeof position === 'number' &&
					Number.isInteger(position) &&
					position >= 1 &&
					position <= 24
				) {
					const points = placementToPoints[position];
					player.points += points;
					player.minimum += points;
					player.maximum += points;
					occupied.add(position);
				} else if (!manuallyComplete) {
					player.remaining++;
					pending.push({ index, weight: chances.get(race.trackEndId)?.get(player.userId) ?? NaN });
				}
			}
			const available = Array.from({ length: 24 }, (_, i) => i + 1).filter((p) => !occupied.has(p));
			for (const { index } of pending) {
				players[index].minimum += placementToPoints[available.at(-1)!] ?? 0;
				players[index].maximum += placementToPoints[available[0]] ?? 0;
			}
			return { pending, available };
		})
		.filter(({ pending }) => pending.length > 0);

	if (manuallyComplete) {
		for (const player of players) player.projected = player.points;
	}

	const canEstimate =
		participants.length > 0 &&
		races.length > 0 &&
		unfinished.every(
			({ pending, available }) =>
				pending.length <= available.length &&
				pending.every(({ weight }) => Number.isFinite(weight) && weight >= 0) &&
				pending.some(({ weight }) => weight > 0)
		);
	if (canEstimate) {
		// A repeatable seed keeps forecasts stable when unrelated page state changes.
		let seed = 7321;
		const random = () => {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;
			return (seed >>> 0) / 4294967296;
		};
		const wins = participants.map(() => 0);
		const podiums = participants.map(() => 0);
		const trials = unfinished.length ? SIMULATIONS : 1;
		for (let trial = 0; trial < trials; trial++) {
			const scores = players.map(({ points }) => points);
			for (const { pending, available } of unfinished) {
				const pool = [...pending];
				for (let place = 0; pool.length; place++) {
					const weight = pool.reduce((sum, player) => sum + player.weight, 0);
					let choice = Math.floor(random() * pool.length);
					if (weight > 0) {
						let draw = random() * weight;
						choice = pool.length - 1;
						for (let i = 0; i < pool.length; i++) {
							draw -= pool[i].weight;
							if (draw < 0) {
								choice = i;
								break;
							}
						}
					}
					const [player] = pool.splice(choice, 1);
					scores[player.index] += placementToPoints[available[place]];
				}
			}
			for (let i = 0; i < players.length; i++) {
				const rank = 1 + scores.filter((score) => score > scores[i]).length;
				if (rank === 1) wins[i]++;
				if (rank <= 3) podiums[i]++;
			}
		}
		players.forEach((player, i) => {
			player.winChance = (wins[i] / trials) * 100;
			player.podiumChance = (podiums[i] / trials) * 100;
		});
	}
	return {
		players,
		completedRaces: races.filter((race) => hasAllResults(participants, race.results)).length,
		totalRaces: races.length,
		simulations: canEstimate && unfinished.length ? SIMULATIONS : 0
	};
}

/** Reconstruct the pre-race outlook using history from before this GP. */
export function calculateStartingGpOutlook<UserId extends string>(
	participants: readonly UserId[],
	races: readonly Race[],
	stats: readonly TrackChances[]
) {
	return calculateGpOutlook(
		participants,
		races.map((race) => ({ ...race, results: [] })),
		stats
	);
}
