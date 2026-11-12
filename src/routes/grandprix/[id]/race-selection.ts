/** Only a race belonging to the current GP can be selected from the URL. */
export function selectGpRace<T extends { _id: string; order: number }>(
	races: readonly T[],
	requestedId: string | null
): T | undefined {
	return (
		races.find((race) => race._id === requestedId) ??
		[...races].sort((a, b) => a.order - b.order)[0]
	);
}
