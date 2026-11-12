/** Group non-deleted GP timeline entries by creation month, including quiet months. */
export function groupGpActivity(entries: readonly { date: number }[]) {
	const counts = new Map<number, number>();
	for (const entry of entries) {
		if (!Number.isFinite(entry.date)) continue;
		const date = new Date(entry.date);
		if (Number.isNaN(date.getTime())) continue;
		const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
		counts.set(month, (counts.get(month) ?? 0) + 1);
	}
	if (!counts.size) return [];
	const first = Math.min(...counts.keys());
	const last = Math.max(...counts.keys());
	const months: { month: string; label: string; gps: number }[] = [];
	const formatter = new Intl.DateTimeFormat('en-GB', {
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
	for (
		const date = new Date(first);
		date.getTime() <= last;
		date.setUTCMonth(date.getUTCMonth() + 1)
	) {
		months.push({
			month: date.toISOString().slice(0, 7),
			label: formatter.format(date),
			gps: counts.get(date.getTime()) ?? 0
		});
	}
	return months;
}
