import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../convex/_generated/api';
import { ConvexClient } from 'convex/browser';
import type { Id } from '../../../convex/_generated/dataModel';
import { readWithTimeout } from '$lib/query-resource';

export const load: PageServerLoad = async ({ params }) => {
	const client = new ConvexClient(PUBLIC_CONVEX_URL);
	let gp;
	try {
		gp = await readWithTimeout(client.query(api.gps.getOne, { id: params.id as Id<'grandPrix'> }));
	} catch {
		error(503, 'Could not load this Grand Prix. Check your connection and try again.');
	} finally {
		await client.close();
	}
	if (!gp) error(404, 'Grand Prix not found');
	return {
		grandPrixDetails: {
			...gp,
			participants: [...gp.participants].sort((a, b) => b.localeCompare(a))
		}
	};
};
