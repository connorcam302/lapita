import coverageData from './data/trackCoverage.json';
import characters from './data/characterStats.json';
import karts from './data/kartsStats.json';
import total1Model from './data/total1Model.json';
import { isValidFinishPosition } from './grand-prix';

type Speeds = { roadSpeed: number; terrainSpeed: number; waterSpeed: number; glidingSpeed: number };
export type Coverage = {
	road: number;
	rough: number;
	water: number;
	gliding: number;
	neutral: number;
};
type Reference = { _id: string; name?: string };
type Race = {
	_id: string;
	order: number;
	trackStartId: string;
	trackEndId: string;
	results: readonly {
		userId: string;
		position?: number | null;
		characterId?: string;
		kartId?: string;
	}[];
};

export const comboCoverageSource = coverageData.source;
export const coverageByTrack = new Map(coverageData.tracks.map((track) => [track.name, track]));

/** Sheet speed gains per stat level. Neutral surfaces do not distinguish combinations.
 * Additive dataset offsets cancel when normalizing against the same catalogue on a track.
 * Averaging the character/kart stats matches Lapita's calculator; common scale cancels too.
 */
export function weightedSpeed(character: Speeds, kart: Speeds, coverage: Coverage) {
	return (
		(coverage.road * 0.003 * (character.roadSpeed + kart.roadSpeed) +
			coverage.rough * 0.003 * (character.terrainSpeed + kart.terrainSpeed) +
			coverage.water * 0.006 * (character.waterSpeed + kart.waterSpeed) +
			coverage.gliding * 0.005 * (character.glidingSpeed + kart.glidingSpeed)) /
		200
	);
}

export type Total1Stats = { [Key in keyof typeof total1Model.characterOffsets]: number };
export const comboRatingSource = total1Model.source;
const statKeys = Object.keys(total1Model.characterOffsets) as (keyof Total1Stats)[];

/** Restore source stat levels before applying nonlinear formulas; never average stat levels. */
export function toTotal1Stats(stats: Total1Stats, kind: 'character' | 'kart'): Total1Stats {
	const offsets = kind === 'character' ? total1Model.characterOffsets : total1Model.kartOffsets;
	return Object.fromEntries(statKeys.map((key) => [key, stats[key] + offsets[key]])) as Total1Stats;
}

/** Actual Total 1 cell formula (Classic Races), with caller-supplied surface coverage. */
export function calculateTotal1(stats: Total1Stats, coverage: Coverage) {
	const m = total1Model;
	const coin = 1 + m.coinCoefficient * (stats.coinCurve - m.coinBaseline);
	const speed =
		m.speedScale *
		((coverage.road / 100) * Math.log((0.967 + 0.003 * stats.roadSpeed) * coin) +
			(coverage.rough / 100) * Math.log((0.97 + 0.003 * stats.terrainSpeed) * coin) +
			(coverage.water / 100) * Math.log((0.94 + 0.006 * stats.waterSpeed) * coin) +
			(coverage.gliding / 100) * Math.log((0.95 + 0.005 * stats.glidingSpeed) * coin) +
			(coverage.neutral / 100) * Math.log(coin));
	const benefit = (level: number) => 1 - Math.exp(-m.handlingDecay * level);
	const handling =
		m.handlingScale *
		m.handlingWeight *
		(((benefit(stats.roadHandling) * coverage.road) / 100) * m.roadHandlingMultiplier +
			(benefit(stats.terrainHandling) * coverage.rough) / 100 +
			(benefit(stats.waterHandling) * coverage.water) / 100);
	const other =
		stats.acceleration * m.accelerationWeight +
		stats.miniTurbo * m.miniTurboWeight +
		stats.weight * m.weightWeight +
		stats.invincibility * m.invincibilityWeight;
	return { speed, handling, other, total: speed + handling + other };
}

const rawCharacters = characters.map((item) => ({
	name: item.name,
	stats: toTotal1Stats(item, 'character')
}));
const rawKarts = karts.map((item) => ({ name: item.name, stats: toTotal1Stats(item, 'kart') }));

function normalize(scores: Map<string, number>) {
	const min = Math.min(...scores.values());
	const max = Math.max(...scores.values());
	return new Map(
		[...scores].map(([name, score]) => [
			name,
			max > min ? Math.max(0, Math.min(100, (100 * (score - min)) / (max - min))) : null
		])
	);
}

const ratingsByTrack = new Map(
	coverageData.tracks.map((coverage) => {
		const pairs = new Map<string, number>();
		const characterTotals = new Map(rawCharacters.map((row) => [row.name, 0]));
		const kartTotals = new Map(rawKarts.map((row) => [row.name, 0]));
		for (const character of rawCharacters) {
			for (const kart of rawKarts) {
				const stats = Object.fromEntries(
					statKeys.map((key) => [key, character.stats[key] + kart.stats[key]])
				) as Total1Stats;
				const score = calculateTotal1(stats, coverage).total;
				pairs.set(`${character.name}|${kart.name}`, score);
				characterTotals.set(
					character.name,
					characterTotals.get(character.name)! + score / rawKarts.length
				);
				kartTotals.set(kart.name, kartTotals.get(kart.name)! + score / rawCharacters.length);
			}
		}
		return [
			coverage.name,
			{
				pairs: normalize(pairs),
				characters: normalize(characterTotals),
				karts: normalize(kartTotals)
			}
		];
	})
);

/** Combined scores mirror Total 1; individual scores average raw totals over all partners. */
export function rateCombo(trackName: string, characterName?: string, kartName?: string) {
	return ratingsByTrack.get(trackName)?.pairs.get(`${characterName}|${kartName}`) ?? null;
}
export const rateCharacter = (trackName: string, name?: string) =>
	name ? (ratingsByTrack.get(trackName)?.characters.get(name) ?? null) : null;
export const rateKart = (trackName: string, name?: string) =>
	name ? (ratingsByTrack.get(trackName)?.karts.get(name) ?? null) : null;

/** Rank selectable pairs using the same full-combo model as GP ratings.
 * Keep source precision for ordering and competition ranks; names only break exact ties.
 */
export function rankTrackCombos<C extends Reference, K extends Reference>(
	trackName: string,
	characters: readonly C[],
	karts: readonly K[]
) {
	const rows = characters.flatMap((character) =>
		karts.flatMap((kart) => {
			const score = rateCombo(trackName, character.name, kart.name);
			return score === null ? [] : [{ character, kart, score }];
		})
	);
	rows.sort(
		(a, b) =>
			b.score - a.score ||
			(a.character.name ?? '').localeCompare(b.character.name ?? '') ||
			(a.kart.name ?? '').localeCompare(b.kart.name ?? '') ||
			a.character._id.localeCompare(b.character._id) ||
			a.kart._id.localeCompare(b.kart._id)
	);
	let rank = 1;
	return rows.map((row, index) => {
		if (index && row.score !== rows[index - 1].score) rank = index + 1;
		return { ...row, rank };
	});
}

/** Group displayed ratings, retaining the exact character choices for each kart. */
export function groupTrackCombos<C extends Reference, K extends Reference>(
	rows: ReturnType<typeof rankTrackCombos<C, K>>
) {
	const groups = new Map<
		string,
		{
			rating: string;
			rank: number;
			setups: { kart: K; characters: C[] }[];
		}
	>();
	for (const [index, row] of rows.entries()) {
		const rating = row.score.toFixed(2);
		let group = groups.get(rating);
		if (!group) {
			group = { rating, rank: index + 1, setups: [] };
			groups.set(rating, group);
		}
		let setup = group.setups.find((setup) => setup.kart._id === row.kart._id);
		if (!setup) {
			setup = { kart: row.kart, characters: [] };
			group.setups.push(setup);
		}
		setup.characters.push(row.character);
	}
	return [...groups.values()];
}

/** Score actual per-race choices, without carrying a previous choice across missing results. */
export function buildGpComboFit(
	participants: readonly string[],
	races: readonly Race[],
	refs: {
		tracks: readonly Reference[];
		characters: readonly Reference[];
		karts: readonly Reference[];
	}
) {
	const trackNames = new Map(refs.tracks.map((r) => [r._id, r.name ?? 'Unknown track']));
	const characterNames = new Map(refs.characters.map((r) => [r._id, r.name]));
	const kartNames = new Map(refs.karts.map((r) => [r._id, r.name]));
	const ordered = [...races].sort((a, b) => a.order - b.order || a._id.localeCompare(b._id));
	return participants.map((userId) => {
		let previousKart: string | undefined;
		let previousOrder: number | undefined;
		let kartChanges = 0;
		const rows = ordered.map((race) => {
			const result = race.results.find((r) => r.userId === userId);
			const recorded = isValidFinishPosition(result?.position);
			const characterName = result?.characterId
				? characterNames.get(result.characterId)
				: undefined;
			const kartName = result?.kartId ? kartNames.get(result.kartId) : undefined;
			const trackName = trackNames.get(race.trackEndId) ?? 'Unknown track';
			const transition = race.trackStartId !== race.trackEndId;
			const choice =
				recorded && result?.characterId && result.kartId
					? `${result.characterId}|${result.kartId}`
					: null;
			if (
				recorded &&
				result?.kartId &&
				previousKart &&
				previousKart !== result.kartId &&
				previousOrder !== undefined &&
				previousOrder + 1 === race.order
			)
				kartChanges++;
			previousKart = recorded ? result?.kartId : undefined;
			previousOrder = race.order;
			const score =
				recorded && choice && !transition ? rateCombo(trackName, characterName, kartName) : null;
			const characterScore =
				recorded && !transition ? rateCharacter(trackName, characterName) : null;
			const kartScore = recorded && !transition ? rateKart(trackName, kartName) : null;
			const reason = !recorded
				? 'No recorded finish'
				: !choice
					? 'Missing character or kart'
					: transition
						? 'No transition coverage'
						: !coverageByTrack.has(trackName)
							? 'No track coverage'
							: score === null
								? 'Unknown character or kart stats'
								: null;
			return {
				raceId: race._id,
				order: race.order,
				trackName,
				startTrackName: trackNames.get(race.trackStartId) ?? 'Unknown track',
				transition,
				characterId: result?.characterId,
				kartId: result?.kartId,
				characterName,
				kartName,
				choice,
				score,
				characterScore,
				kartScore,
				reason,
				coverage: !transition ? (coverageByTrack.get(trackName) ?? null) : null
			};
		});
		const average = (values: (number | null)[]) => {
			const known = values.filter((value): value is number => value !== null);
			return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
		};
		const rated = rows.filter((row) => row.score !== null);
		const usage = new Map<string, { characterName: string; kartName: string; races: number }>();
		for (const row of rows) {
			if (!row.choice) continue;
			const previous = usage.get(row.choice);
			usage.set(row.choice, {
				characterName: row.characterName ?? 'Unknown character',
				kartName: row.kartName ?? 'Unknown kart',
				races: (previous?.races ?? 0) + 1
			});
		}
		const mostRaces = Math.max(0, ...[...usage.values()].map((combo) => combo.races));
		const mostUsed = [...usage.values()]
			.filter((combo) => combo.races === mostRaces)
			.sort(
				(a, b) =>
					a.characterName.localeCompare(b.characterName) || a.kartName.localeCompare(b.kartName)
			);
		const stints: {
			choice: string | null;
			characterName?: string;
			kartName?: string;
			from: number;
			to: number;
			scores: number[];
			races: number;
		}[] = [];
		for (const row of rows) {
			const previous = stints.at(-1);
			if (
				previous &&
				row.choice &&
				previous.choice === row.choice &&
				previous.to + 1 === row.order
			) {
				previous.to = row.order;
				previous.races++;
				if (row.score !== null) previous.scores.push(row.score);
			} else
				stints.push({
					choice: row.choice,
					characterName: row.characterName,
					kartName: row.kartName,
					from: row.order,
					to: row.order,
					races: 1,
					scores: row.score === null ? [] : [row.score]
				});
		}
		return {
			userId,
			mostUsed,
			characterScore: average(rows.map((row) => row.characterScore)),
			kartScore: average(rows.map((row) => row.kartScore)),
			rows,
			stints,
			kartChanges,
			totalRaces: rows.length,
			ratedRaces: rated.length,
			setups: new Set(rows.flatMap((row) => (row.choice ? [row.choice] : []))).size,
			score: rated.length ? rated.reduce((sum, row) => sum + row.score!, 0) / rated.length : null
		};
	});
}

export type GpComboFit = ReturnType<typeof buildGpComboFit>;
