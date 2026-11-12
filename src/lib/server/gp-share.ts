import { error } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { readWithTimeout } from '$lib/query-resource';
import { buildRecap } from '$lib/gp-recap';
import { buildGpComboFit } from '$lib/gp-combo-fit';
import { calculatePointsComparison } from '../../routes/grandprix/[id]/expected-points';
import { calculateStartingGpOutlook } from '../../routes/grandprix/[id]/gp-outlook';

const client = () => new ConvexHttpClient(PUBLIC_CONVEX_URL);
export async function getGpShareBase(id: string) {
	const convex = client();
	let gp;
	try {
		gp = await readWithTimeout(convex.query(api.gps.getOne, { id: id as Id<'grandPrix'> }), 5000);
	} catch (cause) {
		if (
			cause instanceof Error &&
			/ArgumentValidationError|Invalid.*ID|not a valid.*Id/i.test(cause.message)
		)
			error(404, 'Grand Prix not found');
		error(503, 'Grand Prix preview is temporarily unavailable');
	}
	if (!gp) error(404, 'Grand Prix not found');
	const [races, users] = await readWithTimeout(
		Promise.all([
			convex.query(api.results.get, { grandPrixId: gp._id }),
			convex.query(api.users.getAllUsers, {})
		]),
		5000
	).catch(() => error(503, 'Grand Prix preview is temporarily unavailable'));
	return {
		gp,
		races: races ?? [],
		users,
		recap: buildRecap(gp.participants, races ?? [], gp.completedAt)
	};
}
export type GpShareBase = Awaited<ReturnType<typeof getGpShareBase>>;

/** Optional forecasts may be unavailable; recorded scores must still render accurately. */
export async function getGpShareExtras(base: GpShareBase) {
	const convex = client();
	const { gp, races } = base;
	const tracks = [...new Set(races.map((race) => race.trackEndId))];
	const [trackList, characters, karts, currentStats, startingStats] = await Promise.all([
		readWithTimeout(convex.query(api.tracks.all, {}), 5000),
		readWithTimeout(convex.query(api.characters.all, {}), 5000),
		readWithTimeout(convex.query(api.karts.all, {}), 5000),
		readWithTimeout(
			convex.query(api.results.stats, { tracks, users: gp.participants }),
			5000
		).catch(() => null),
		readWithTimeout(
			convex.query(api.results.stats, {
				tracks,
				users: gp.participants,
				beforeGrandPrixId: gp._id
			}),
			5000
		).catch(() => null)
	]);
	return {
		comparisons: currentStats
			? calculatePointsComparison(gp.participants, races, currentStats)
			: [],
		startingPlayers: startingStats
			? calculateStartingGpOutlook(gp.participants, races, startingStats).players
			: [],
		comboRatings: buildGpComboFit(gp.participants, races, { tracks: trackList, characters, karts })
	};
}
