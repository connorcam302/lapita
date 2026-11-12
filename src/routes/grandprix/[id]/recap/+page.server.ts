import { error } from '@sveltejs/kit';
import { ConvexHttpClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const client = new ConvexHttpClient(PUBLIC_CONVEX_URL);
	let grandPrix;
	try {
		grandPrix = await client.query(api.gps.getOne, { id: params.id as Id<'grandPrix'> });
	} catch {
		error(503, 'Could not load this Grand Prix. Please try again.');
	}
	if (!grandPrix) error(404, 'Grand Prix not found');
	return { grandPrix };
};
