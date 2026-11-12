type EraPoint = { order: number; era?: string };
export type EraBand = { era: string; from: number; to: number; color: string };

/** A name keeps its color when the metric, players, or available history changes. */
export function eraColor(era: string) {
	let hash = 0;
	for (const character of era) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) | 0;
	return `oklch(0.7 0.14 ${((hash % 360) + 360) % 360})`;
}

/** Missing GP numbers and untagged GPs break bands, even if the next era has the same name. */
export function groupEraBands(timeline: readonly EraPoint[]): EraBand[] {
	const bands: EraBand[] = [];
	for (const gp of [...timeline].sort((a, b) => a.order - b.order)) {
		if (!gp.era) continue;
		const previous = bands.at(-1);
		if (previous && previous.era === gp.era && previous.to + 1 === gp.order) {
			previous.to = gp.order;
		} else {
			bands.push({ era: gp.era, from: gp.order, to: gp.order, color: eraColor(gp.era) });
		}
	}
	return bands;
}
