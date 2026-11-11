import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type TrackStats = FunctionReturnType<typeof api.races.getStats>;

export function comparePlayerTracks(tracks: TrackStats, userId: Id<'users'>) {
	return tracks.map((track) => {
		const racers = track.userAverages
			.filter(
				(racer): racer is typeof racer & { average: number } =>
					typeof racer.average === 'number' && Number.isFinite(racer.average)
			)
			.sort((a, b) => a.average - b.average || a.userName.localeCompare(b.userName));
		const player = racers.find((racer) => racer.userId === userId);
		const opponents = racers.filter((racer) => racer.userId !== userId);
		const rival = opponents[0];
		const leader = racers[0];
		const rank = player
			? 1 + racers.filter((racer) => racer.average < player.average).length
			: null;
		const gap = player && leader ? player.average - leader.average : null;
		const margin = player && rival ? rival.average - player.average : null;
		const status = !player ? 'unraced' : !rival ? 'solo' : rank === 1 ? 'leading' : 'chasing';
		return { ...track, player, rival, rank, gap, margin, status, racerCount: racers.length };
	});
}

export function formatGap(value: number) {
	return value > 0 && value < 0.01 ? '<0.01' : value.toFixed(2);
}
