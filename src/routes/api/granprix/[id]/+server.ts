import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRaceResultsByGpId } from '$lib/server/serverUtils';

export const GET: RequestHandler = async ({ params }) => {
	return json(await getRaceResultsByGpId(params.id));
};
