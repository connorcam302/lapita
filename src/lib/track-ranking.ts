/** Minimum valid finishes for track leaders and best/worst track highlights. */
export const TRACK_MIN_RESULTS = 5;

export function hasTrackSample(count: number) {
	return count >= TRACK_MIN_RESULTS;
}
