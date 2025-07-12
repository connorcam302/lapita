import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRaceResultsByGpId } from '$lib/server/serverUtils';
import type { Config } from '@sveltejs/adapter-vercel';

export const config: Config = {
	runtime: 'edge'
};

export const GET: RequestHandler = async ({ params }) => {
	return json(await getRaceResultsByGpId(params.id));
};
