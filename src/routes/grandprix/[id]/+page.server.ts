import type { PageServerLoad } from './$types';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../convex/_generated/api';
import { ConvexClient } from 'convex/browser';
import type { Id } from '../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ params }) => {
	const client = new ConvexClient(PUBLIC_CONVEX_URL);
	const grandPrixDetails = await client
		.query(api.gps.getOne, { id: params.id as Id<'grandPrix'> })
		.then((res) => {
			const participantsSorted = res.participants.sort((a, b) => {
				return b.localeCompare(a);
			});

			return {
				...res,
				participants: participantsSorted
			};
		});

	return {
		grandPrixDetails
	};
};
