import type { Handle } from '@sveltejs/kit';
import { getGpShareBase } from '$lib/server/gp-share';
import { gpEmbedTags, gpShareMetadata } from '$lib/gp-embed';

/** GP pages remain client-rendered; unfurlers need metadata in the HTML shell. */
export const handle: Handle = async ({ event, resolve }) => {
	if (
		event.isDataRequest ||
		!['GET', 'HEAD'].includes(event.request.method) ||
		!['/grandprix/[id]', '/grandprix/[id]/recap'].includes(event.route.id ?? '')
	)
		return resolve(event);
	let metadata = '';
	try {
		const base = await getGpShareBase(event.params.id!);
		metadata = gpEmbedTags(
			gpShareMetadata(base, event.url, event.route.id === '/grandprix/[id]/recap')
		);
	} catch {
		// Preview outages must not prevent the app from loading its own recovery UI.
		return resolve(event);
	}
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('</head>', `${metadata}</head>`)
	});
};
