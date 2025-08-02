import type { PageServerLoad } from './$types';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../../../convex/_generated/api';
import { ConvexClient } from 'convex/browser';
import type { Id } from '../../../convex/_generated/dataModel';

export const load: PageServerLoad = async ({ params }) => {
	const client = new ConvexClient(PUBLIC_CONVEX_URL);

	console.log(params.userId);
	const userDetails = await client.query(api.users.getOne, {
		id: params.userId as Id<'users'>
	});

	return {
		userDetails
	};
};
