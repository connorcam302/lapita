import { hasTrackSample } from './track-ranking';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../convex/_generated/api';

type TrackStats = FunctionReturnType<typeof api.races.getStats>;
type OwnershipStatus = 'unraced' | 'low-sample' | 'solo' | 'shared' | 'outright';

/** Filter eligibility before ranking; never round averages before comparing. */
export function trackOwnership(tracks: TrackStats) {
	return tracks.map((track) => {
		const recorded = track.userAverages.filter(
			(player) => player.count > 0 && Number.isFinite(player.average)
		);
		const eligible = recorded
			.filter((player) => hasTrackSample(player.count))
			.sort(
				(a, b) =>
					a.average - b.average ||
					a.userName.localeCompare(b.userName) ||
					a.userId.localeCompare(b.userId)
			);
		const leaders = eligible.filter((player) => player.average === eligible[0].average);
		const status: OwnershipStatus = !recorded.length
			? 'unraced'
			: !eligible.length
				? 'low-sample'
				: eligible.length === 1
					? 'solo'
					: leaders.length > 1
						? 'shared'
						: 'outright';
		return {
			...track,
			leaders,
			eligible,
			belowMinimum: recorded.filter((player) => !hasTrackSample(player.count)),
			resultCount: recorded.reduce((sum, player) => sum + player.count, 0),
			status,
			gap: eligible.length > 1 ? eligible[1].average - eligible[0].average : null
		};
	});
}

export function ownershipSummary(tracks: ReturnType<typeof trackOwnership>, userId?: string) {
	const leads = tracks.filter(
		(track) => !userId || track.leaders.some((player) => player.userId === userId)
	);
	return {
		outright: leads.filter((track) => track.status === 'outright').length,
		shared: leads.filter((track) => track.status === 'shared').length,
		solo: leads.filter((track) => track.status === 'solo').length
	};
}

export function ownershipGap(gap: number) {
	return gap > 0 && gap < 0.01 ? '<0.01' : gap.toFixed(2);
}

/** Every competitive track contributes one unit, divided equally among tied owners. */
export function ownershipShares(tracks: ReturnType<typeof trackOwnership>) {
	const shares = new Map<
		string,
		{
			userId: string;
			userName: string;
			weight: number;
			tracks: { trackId: TrackStats[number]['trackId']; trackName: string; shared: boolean }[];
		}
	>();
	let unclaimed = 0;
	for (const track of tracks) {
		if (track.status !== 'outright' && track.status !== 'shared') {
			unclaimed++;
			continue;
		}
		for (const leader of track.leaders) {
			const share = shares.get(leader.userId) ?? {
				userId: leader.userId,
				userName: leader.userName,
				weight: 0,
				tracks: []
			};
			share.weight += 1 / track.leaders.length;
			share.tracks.push({
				trackId: track.trackId,
				trackName: track.trackName,
				shared: track.status === 'shared'
			});
			shares.set(leader.userId, share);
		}
	}
	return {
		players: [...shares.values()].sort(
			(a, b) => b.weight - a.weight || a.userName.localeCompare(b.userName)
		),
		unclaimed,
		total: tracks.length
	};
}
