import { hasTrackSample } from '$lib/track-ranking';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';

type TrackStats = FunctionReturnType<typeof api.races.getStats>;

export function comparePlayerTracks(tracks: TrackStats, userId: Id<'users'>) {
	return tracks.map((track) => {
		const racers = track.userAverages
			.filter(
				(racer): racer is typeof racer & { average: number } =>
					hasTrackSample(racer.count) &&
					typeof racer.average === 'number' &&
					Number.isFinite(racer.average)
			)
			.sort((a, b) => a.average - b.average || a.userName.localeCompare(b.userName));
		const player = track.userAverages.find((racer) => racer.userId === userId);
		const eligiblePlayer =
			player && hasTrackSample(player.count) && Number.isFinite(player.average)
				? player
				: undefined;
		const opponents = racers.filter((racer) => racer.userId !== userId);
		const rival = opponents[0];
		const leader = racers[0];
		const rank = eligiblePlayer
			? 1 + racers.filter((racer) => racer.average < eligiblePlayer.average).length
			: null;
		const gap = eligiblePlayer && leader ? eligiblePlayer.average - leader.average : null;
		const margin = eligiblePlayer && rival ? rival.average - eligiblePlayer.average : null;
		const status = !player
			? 'unraced'
			: !eligiblePlayer
				? 'low-sample'
				: !rival
					? 'solo'
					: rank === 1
						? 'leading'
						: 'chasing';
		const leaders = racers.filter((racer) => racer.average === leader?.average);
		const signedGap = eligiblePlayer && rival ? eligiblePlayer.average - rival.average : null;
		return {
			...track,
			player,
			rival,
			leaders,
			rank,
			gap,
			margin,
			signedGap,
			status,
			racerCount: racers.length
		};
	});
}

export function formatGap(value: number) {
	return value > 0 && value < 0.01 ? '<0.01' : value.toFixed(2);
}
