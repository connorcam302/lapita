/** Only integer finishes in the game's 24-place field can earn points. */
export function isValidFinishPosition(position: unknown): position is number {
	return (
		typeof position === 'number' && Number.isInteger(position) && position >= 1 && position <= 24
	);
}

/** A race is complete only when every participant has a valid finishing position. */
export function hasAllResults(
	participants: readonly string[],
	results: readonly { userId: string; position?: number | null }[]
) {
	return (
		participants.length > 0 &&
		participants.every((userId) =>
			results.some((result) => result.userId === userId && isValidFinishPosition(result.position))
		)
	);
}
