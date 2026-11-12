import type { Recap } from './gp-recap';
import { recapImageSize } from './recap-image';
export type GpEmbed = {
	title: string;
	description: string;
	url: string;
	image: string;
	imageAlt: string;
	width: number;
	height: number;
};

const escapeAttribute = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');

/** These tags must be in the initial HTML: link-preview clients do not run Svelte. */
export function gpEmbedTags(embed: GpEmbed) {
	const tags: Record<string, string> = {
		'og:type': 'website',
		'og:site_name': 'Lapita',
		'og:title': embed.title,
		'og:description': embed.description,
		'og:url': embed.url,
		'og:image': embed.image,
		'og:image:type': 'image/png',
		'og:image:alt': embed.imageAlt,
		'og:image:width': String(embed.width),
		'og:image:height': String(embed.height)
	};
	return (
		Object.entries(tags)
			.map(
				([property, value]) => `<meta property="${property}" content="${escapeAttribute(value)}">`
			)
			.join('') +
		`<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeAttribute(embed.title)}"><meta name="twitter:description" content="${escapeAttribute(embed.description)}"><meta name="twitter:image" content="${escapeAttribute(embed.image)}"><meta name="twitter:image:alt" content="${escapeAttribute(embed.imageAlt)}">`
	);
}

export type GpEmbedSource = {
	gp: { _id: string; order: number };
	recap: Recap;
};

export function gpShareMetadata(base: GpEmbedSource, url: URL, recapPage: boolean): GpEmbed {
	const { gp, recap } = base;
	const canonical = new URL(`/grandprix/${gp._id}${recapPage ? '/recap' : ''}`, url.origin);
	const image = new URL(
		recap.complete ? `/grandprix/${gp._id}/recap.png` : '/lapita-logo.png',
		url.origin
	);
	const description = recap.complete
		? `${recap.raceCount} races · ${recap.standings.length} racers. Final standings, xPoints and combo ratings.${recap.fullHistory ? '' : ` Manually completed; ${recap.missing} missing ${recap.missing === 1 ? 'finish' : 'finishes'}. Recorded results only.`}`
		: 'Race results and standings for this Grand Prix.';
	return {
		title: `Grand Prix ${gp.order}${recapPage ? ' recap' : ''} · Lapita`,
		description,
		url: canonical.href,
		image: image.href,
		imageAlt: recap.complete
			? `Grand Prix ${gp.order} recap: podium, standings and combo ratings${recap.fullHistory ? '' : ' (incomplete race history)'}`
			: 'Lapita logo',
		width: recap.complete ? recapImageSize(recap).width : 680,
		height: recap.complete ? recapImageSize(recap).height : 680
	};
}
