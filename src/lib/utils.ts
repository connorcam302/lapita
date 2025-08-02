import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Id } from '../convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '../convex/_generated/api';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export const addNumberSuffix = (num: number): string => {
	const lastDigit = num % 10;
	const lastTwoDigits = num % 100;

	// Handle special cases for 11th, 12th, 13th
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return num + 'th';
	}

	// Handle regular cases
	switch (lastDigit) {
		case 1:
			return num + 'st';
		case 2:
			return num + 'nd';
		case 3:
			return num + 'rd';
		default:
			return num + 'th';
	}
};

export const placementToPoints: Record<number, number> = {
	0: 0,
	1: 15,
	2: 12,
	3: 10,
	4: 9,
	5: 9,
	6: 8,
	7: 8,
	8: 7,
	9: 7,
	10: 6,
	11: 6,
	12: 6,
	13: 5,
	14: 5,
	15: 5,
	16: 4,
	17: 4,
	18: 4,
	19: 3,
	20: 3,
	21: 3,
	22: 2,
	23: 2,
	24: 1
};

const clamp = (val: number) => Math.max(0, Math.min(255, val));
const toHex = (val: number) => clamp(val).toString(16).padStart(2, '0');

export const rgbToHex = (rgbString: string) => {
	// Extract numbers from rgb string using regex
	const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

	if (!match) {
		throw new Error('Invalid RGB string format');
	}

	// Parse the RGB values
	const r = parseInt(match[1]);
	const g = parseInt(match[2]);
	const b = parseInt(match[3]);

	// Convert to hex and pad with zeros if needed
	const toHex = (n) => n.toString(16).padStart(2, '0');

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const getPositionColour = (position: number): string => {
	if (!position || position < 1 || position > 24) return '#00000000'; // gray-300

	if (position === 1) return '#00a63e'; // Pure green

	if (position <= 4) {
		// Green (#00a63e) to yellow-orange (#ffcc00)
		const ratio = (position - 1) / 3; // 0 to 1
		const red = Math.round(0 + (255 - 0) * ratio);
		const green = Math.round(166 + (204 - 166) * ratio); // 166 → 204
		const blue = Math.round(62 - 62 * ratio); // 62 → 0
		return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
	}

	// Yellow-orange (#ffcc00) to red (#ff0000)
	const ratio = (position - 4) / 20; // 0 to 1
	const red = 255;
	const green = Math.round(204 - 204 * ratio); // 204 → 0
	const blue = 0;
	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

export const calculateConsistency = (positions: number[]) => {
	positions = positions.filter((num) => !Number.isNaN(num));
	if (positions.length < 2) return 1;

	const avg = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;

	const variance =
		positions.reduce((sum, pos) => sum + Math.pow(pos - avg, 2), 0) / positions.length;
	const stdDev = Math.sqrt(variance);

	const consistency = Math.max(0, 1 - stdDev / 5);

	return Math.round(consistency * 100) / 100;
};

export const getConsistencyColorGradient = (consistency: number) => {
	// Clamp consistency between 0 and 1
	consistency = Math.min(1, Math.max(0, consistency));

	// Define gradient stops
	const gradient = [
		{ stop: 0.0, color: [255, 0, 0] }, // Red
		{ stop: 0.25, color: [255, 128, 0] }, // Orange
		{ stop: 0.5, color: [255, 255, 0] }, // Yellow
		{ stop: 0.75, color: [128, 255, 0] }, // Light Green
		{ stop: 1.0, color: [0, 128, 0] } // Dark Green
	];

	// Find the two stops this consistency is between
	for (let i = 0; i < gradient.length - 1; i++) {
		const left = gradient[i];
		const right = gradient[i + 1];

		if (consistency >= left.stop && consistency <= right.stop) {
			// Interpolate between left.color and right.color
			const range = right.stop - left.stop;
			const rangeconsistency = (consistency - left.stop) / range;

			const r = Math.round(left.color[0] + (right.color[0] - left.color[0]) * rangeconsistency);
			const g = Math.round(left.color[1] + (right.color[1] - left.color[1]) * rangeconsistency);
			const b = Math.round(left.color[2] + (right.color[2] - left.color[2]) * rangeconsistency);

			return `rgb(${r}, ${g}, ${b})`;
		}
	}

	// Should not reach here, but fallback
	return 'rgb(0, 128, 0)';
};

export const getPlayerName = (
	playerList: Awaited<FunctionReturnType<typeof api.users.getAllUsers>>,
	id: Id<'users'>
) => {
	return playerList.find((player) => player._id === id)?.name || 'Unknown';
};

export const getTrackName = (
	trackList: Awaited<FunctionReturnType<typeof api.tracks.all>>,
	id: Id<'tracks'>
) => {
	return trackList.find((track) => track._id === id)?.name || 'Unknown';
};

export const getTrackImage = (
	trackList: Awaited<FunctionReturnType<typeof api.tracks.all>>,
	id: Id<'tracks'>
) => {
	return trackList.find((track) => track._id === id)?.img || '';
};

export const getKartName = (
	kartList: Awaited<FunctionReturnType<typeof api.karts.all>>,
	id: Id<'karts'>
) => {
	return kartList.find((kart) => kart._id === id)?.name || 'Unknown';
};

export const getKartImage = (
	kartList: Awaited<FunctionReturnType<typeof api.karts.all>>,
	id: Id<'karts'>
) => {
	return kartList.find((kart) => kart._id === id)?.img || '';
};

export const getCharacterName = (
	characterList: Awaited<FunctionReturnType<typeof api.characters.all>>,
	id: Id<'characters'>
) => {
	return characterList.find((character) => character._id === id)?.name || 'Unknown';
};

export const getCharacterImage = (
	characterList: Awaited<FunctionReturnType<typeof api.characters.all>>,
	id: Id<'characters'>
) => {
	return characterList.find((character) => character._id === id)?.img || '';
};

export const calculateRaceWinChance = (trackAverages, recentRaces = [], formWeight = 0.3) => {
	const trackList = Array.from(new Set(trackAverages.map((track) => track.trackId)));

	return trackList.map((trackId) => {
		const averageForTrack = trackAverages.filter((track) => track.trackId === trackId);

		const usersByWeight = averageForTrack.map((user) => {
			const avgPosition = parseFloat(user.avg);

			// Base weight from historical average (aggressive approach)
			const baseWeight = Math.pow(12 / avgPosition, 2);

			// Calculate form factor from recent races
			const userRecentRaces = recentRaces.filter((race) => race.userId === user.userId);
			let formFactor = 1.0; // Neutral form

			if (userRecentRaces.length > 0) {
				// Get average of recent positions (lower is better)
				const recentAvg =
					userRecentRaces.reduce((sum, race) => sum + race.position, 0) / userRecentRaces.length;

				// Compare recent form to historical average
				const formDifference = avgPosition - recentAvg;

				// Form factor: positive difference = good form, negative = bad form
				// Scale: each position better/worse = ±15% change
				formFactor = 1 + formDifference * 0.15;

				// Cap form factor between 0.5 and 2.0 to prevent extreme swings
				formFactor = Math.max(0.5, Math.min(2.0, formFactor));
			}

			// Combine base weight with form
			const finalWeight = baseWeight * (1 - formWeight + formWeight * formFactor);

			return {
				...user,
				average: avgPosition,
				recentForm:
					userRecentRaces.length > 0
						? userRecentRaces.reduce((sum, race) => sum + race.position, 0) / userRecentRaces.length
						: null,
				formFactor: formFactor,
				baseWeight: baseWeight,
				finalWeight: finalWeight
			};
		});

		// Sort by final weight (highest first)
		usersByWeight.sort((a, b) => b.finalWeight - a.finalWeight);

		const totalWeight = usersByWeight.reduce((acc, val) => acc + val.finalWeight, 0);

		return usersByWeight.map((user, index) => {
			const chance = (user.finalWeight / totalWeight) * 100;
			return {
				user,
				formFactor: Math.round(user.formFactor * 100) / 100,
				rankPosition: index + 1,
				chance: Math.round(chance * 100) / 100
			};
		});
	});
};

export const getStatColour = (value) => {
	const colors = [
		'#DC2626', // 0 - Red
		'#EA580C', // 1 - Red-Orange
		'#F59E0B', // 2 - Orange
		'#EAB308', // 3 - Yellow-Orange
		'#84CC16', // 4 - Yellow-Green
		'#65A30D', // 5 - Light Green
		'#22C55E', // 6 - Bright Green
		'#16A34A', // 7 - Green
		'#15803D', // 8 - Medium Green
		'#166534', // 9 - Darker Green
		'#059669', // 10 - Emerald Green
		'#059669' // 11 - Emerald Green
	];

	const clampedValue = Math.max(0, Math.min(10, Math.floor(value)));
	return colors[clampedValue];
};

export const chartColours = [
	'#EF4444', // red-500
	'#3B82F6', // blue-500
	'#10B981', // green-500
	'#EAB308', // yellow-500
	'#8B5CF6', // purple-500
	'#EC4899', // pink-500
	'#6366F1', // indigo-500
	'#F97316', // orange-500
	'#14B8A6', // teal-500
	'#06B6D4', // cyan-500
	'#84CC16', // lime-500
	'#059669', // emerald-500
	'#7C3AED', // violet-500
	'#D946EF', // fuchsia-500
	'#F43F5E' // rose-500
];

interface RaceResult {
	_creationTime: number;
	_id: string;
	characterId?: string; // Can be undefined
	kartId?: string; // Can be undefined
	grandPrixId: string;
	position: number; // Race position (e.g., 1st, 2nd, 3rd)
	raceId: string;
	trackEndId: string;
	trackStartId: string;
	userId: string;
}

interface GPResult {
	grandPrixId: string;
	order: number;
	points: number;
	position: number; // GP final position (e.g., 1st, 2nd, 3rd)
	// IMPORTANT: Adding userId here. If your actual 'results' array doesn't have it,
	// you'll need to adjust how you link GP outcomes back to users.
	userId: string;
}

interface CharacterKartStats {
	averagePlacement: number;
	bestTrack: string | null;
	worstTrack: string | null;
	gpWins: number;
	averageGpPoints: number;
	// Internal counters
	_totalRacePlacements: number;
	_raceCount: number;
	_gpPointsSum: number;
	_gpCount: number;
	_trackPlacements: Map<string, number[]>; // Map<trackId, [placements...]>
}

export const analyzeCharacterKartCombinations = (
	resultsData: RaceResult[],
	gpResults: GPResult[]
) => {
	// Filter out invalid race results first
	const validResultsData = resultsData.filter((r) => r.characterId && r.kartId);

	const uniqueKartCharacterCombos = [
		...new Set(validResultsData.map((r) => `${r.kartId}-${r.characterId}`))
	].map((combo) => {
		const [kartId, characterId] = combo.split('-');
		return { kartId, characterId };
	});

	const gpStats = gpResults
		.map((gpResult) => {
			const resultsForGp = validResultsData.filter((r) => r.grandPrixId === gpResult.grandPrixId);

			const mostUsedCombo = resultsForGp.reduce((acc, r) => {
				const combo = `${r.kartId}-${r.characterId}`;
				acc[combo] = (acc[combo] || 0) + 1;
				return acc;
			}, {});

			const { kartId, characterId } = Object.entries(mostUsedCombo).reduce(
				(acc, [combo, count]) => {
					if (count > acc.count) {
						acc.kartId = combo.split('-')[0];
						acc.characterId = combo.split('-')[1];
						acc.count = count;
					}
					return acc;
				},
				{ kartId: '', characterId: '', count: 0 }
			);

			return { kartId, characterId, ...gpResult };
		})
		.filter((gpResult) => gpResult.kartId && gpResult.characterId);

	const characterKartStats = uniqueKartCharacterCombos.map((combo) => {
		const { kartId, characterId } = combo;

		const raceCount = validResultsData.filter(
			(r) => r.kartId === kartId && r.characterId === characterId
		).length;

		const gpCount = gpStats.filter(
			(gpResult) => gpResult.kartId === kartId && gpResult.characterId === characterId
		).length;

		const comboAveragePlacement =
			validResultsData
				.filter((r) => r.kartId === kartId && r.characterId === characterId)
				.reduce((acc, r) => acc + r.position, 0) / raceCount;

		const averagesPerTrack = validResultsData
			.filter((r) => r.kartId === kartId && r.characterId === characterId)
			.reduce((acc, r) => {
				acc[r.trackStartId] = (acc[r.trackStartId] || []).concat(r.position);
				return acc;
			}, {});

		const comboBestTrack = Object.entries(averagesPerTrack).reduce(
			(acc, [trackId, placements]) => {
				const average = placements.reduce((acc, p) => acc + p, 0) / placements.length;
				if (average < acc.average) {
					acc.average = average;
					acc.trackId = trackId;
				}
				return acc;
			},
			{ average: Infinity, trackId: '' }
		).trackId;

		const bestTrackAverage =
			averagesPerTrack[comboBestTrack].reduce((acc, p) => acc + p, 0) /
			averagesPerTrack[comboBestTrack].length;

		const comboWorstTrack = Object.entries(averagesPerTrack).reduce(
			(acc, [trackId, placements]) => {
				const average = placements.reduce((acc, p) => acc + p, 0) / placements.length;
				if (average > acc.average) {
					acc.average = average;
					acc.trackId = trackId;
				}
				return acc;
			},
			{ average: -Infinity, trackId: '' }
		).trackId;

		const worstTrackAverage =
			averagesPerTrack[comboWorstTrack].reduce((acc, p) => acc + p, 0) /
			averagesPerTrack[comboWorstTrack].length;

		const averageGpPoints =
			gpStats
				.filter((gpResult) => gpResult.kartId === kartId && gpResult.characterId === characterId)
				.reduce((acc, gpResult) => acc + gpResult.points, 0) / gpCount;

		const gpWins = gpStats.filter(
			(gpResult) =>
				gpResult.kartId === kartId &&
				gpResult.characterId === characterId &&
				gpResult.position === 1
		).length;

		return {
			kartId,
			characterId,
			averagePlacement: comboAveragePlacement,
			bestTrack: comboBestTrack,
			bestTrackAverage,
			worstTrack: comboWorstTrack,
			worstTrackAverage,
			raceCount,
			averageGpPoints,
			gpWins
		};
	});

	return characterKartStats.sort((a, b) => b.raceCount - a.raceCount);
};
