/** A race is complete only when every participant has a valid finishing position. */
export function hasAllResults(
	participants: readonly string[],
	results: readonly { userId: string; position?: number | null }[]
) {
	return (
		participants.length > 0 &&
		participants.every((userId) =>
			results.some(
				(result) =>
					result.userId === userId &&
					typeof result.position === 'number' &&
					Number.isInteger(result.position) &&
					result.position >= 1 &&
					result.position <= 24
			)
		)
	);
}
