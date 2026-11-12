import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { read } from '$app/server';
import logoAsset from '../../../static/lapita-logo.png?url';
import bungee from './recap-assets/Bungee.ttf?url';
import inter from './recap-assets/Inter-Regular.ttf?url';
import semibold from './recap-assets/Inter-Semibold.ttf?url';
import bold from './recap-assets/Inter-Bold.ttf?url';
import { renderRecapImage } from '$lib/recap-image';
import { getGpShareExtras, type GpShareBase } from './gp-share';

let assets: Promise<Awaited<ReturnType<typeof loadImage>>> | undefined;
function getAssets() {
	return (assets ??= Promise.all([
		...[
			[bungee, 'Bungee'],
			[inter, 'Inter'],
			[semibold, 'Inter'],
			[bold, 'Inter']
		].map(async ([path, family]) => {
			if (!GlobalFonts.register(Buffer.from(await read(path).arrayBuffer()), family))
				throw new Error('Could not load recap fonts');
		}),
		read(logoAsset)
			.arrayBuffer()
			.then((data) => loadImage(Buffer.from(data)))
	])
		.then((results) => results.at(-1) as Awaited<ReturnType<typeof loadImage>>)
		.catch((cause) => {
			assets = undefined;
			throw cause;
		}));
}

const cache = new Map<string, { expires: number; image: Promise<Buffer> }>();
/** Small cache; callers revalidate the GP's existence and completion before reaching it. */
export function gpRecapPng(base: GpShareBase) {
	const key = JSON.stringify([base.gp, base.races, base.users]);
	const existing = cache.get(key);
	if (existing && existing.expires > Date.now()) return existing.image;
	const image = Promise.all([getAssets(), getGpShareExtras(base)])
		.then(([logo, extras]) => {
			const canvas = createCanvas(1, 1);
			const names = new Map(base.users.map((user) => [user._id as string, user.name]));
			renderRecapImage(
				canvas as unknown as HTMLCanvasElement,
				base.gp.order,
				base.recap,
				(id) => names.get(id) ?? 'Unknown racer',
				extras,
				logo as unknown as CanvasImageSource
			);
			return canvas.toBuffer('image/png');
		})
		.catch((cause) => {
			cache.delete(key);
			throw cause;
		});
	if (cache.size >= 24) cache.delete(cache.keys().next().value!);
	cache.set(key, { expires: Date.now() + 60_000, image });
	return image;
}
