import { error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { getGpShareBase } from '$lib/server/gp-share';
import { gpRecapPng } from '$lib/server/recap-png';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	const base = await getGpShareBase(params.id);
	if (!base.recap.complete)
		error(404, 'A recap image is available after this Grand Prix is completed');
	let image;
	try {
		image = await gpRecapPng(base);
	} catch {
		error(503, 'Could not generate the recap image. Please try again.');
	}
	const etag = `"${createHash('sha256').update(image).digest('hex')}"`;
	const headers = {
		'Content-Type': 'image/png',
		'Cache-Control': 'public, max-age=60, must-revalidate',
		ETag: etag,
		'X-Content-Type-Options': 'nosniff'
	};
	if (request.headers.get('if-none-match') === etag)
		return new Response(null, { status: 304, headers });
	return new Response(new Uint8Array(image), { headers });
};
