/** Round a whole probability distribution together, preserving its 100% total. */
export function formatWinPercentages(values: readonly number[]): string[] {
	if (!values.length) return [];
	const total = values.reduce((sum, value) => sum + value, 0);
	if (!(total > 0) || values.some((value) => !Number.isFinite(value) || value < 0)) {
		return values.map(() => '—');
	}
	const percentages = values.map((value) => (value / total) * 100);
	// Retain two meaningful digits for the smallest chance (or distance from certainty).
	const smallest = Math.min(
		...percentages
			.filter((value) => value > 0 && value < 100)
			.map((value) => Math.min(value, 100 - value))
	);
	const decimals = Number.isFinite(smallest)
		? Math.min(12, Math.max(1, 1 - Math.floor(Math.log10(smallest))))
		: 1;
	const scale = 10 ** decimals;
	const units = percentages.map((value) => value * scale);
	const rounded = units.map(Math.floor);
	const remainder = Math.round(100 * scale - rounded.reduce((sum, value) => sum + value, 0));
	const order = units
		.map((value, index) => ({ index, fraction: value - rounded[index] }))
		.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
	for (let i = 0; i < remainder; i++) rounded[order[i % order.length].index]++;
	return rounded.map((value) => `${Number((value / scale).toFixed(decimals))}%`);
}
