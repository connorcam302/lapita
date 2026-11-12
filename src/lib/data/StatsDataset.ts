import characterStatsDataset from './characterStats.json';
import kartStatsDataset from './kartsStats.json';

// Define the character stats interface
export interface Stats {
	name: string;
	roadSpeed: number;
	terrainSpeed: number;
	waterSpeed: number;
	acceleration: number;
	weight: number;
	roadHandling: number;
	terrainHandling: number;
	waterHandling: number;
	glidingSpeed: number;
	miniTurbo: number;
	coinCurve: number;
	traction: number;
	invincibility: number;
}

// Utility functions for working with the dataset
class Dataset {
	constructor(private stats: Stats[]) {}

	// Find character by name
	getByName(name: string): Stats | undefined {
		return this.stats.find((char) => char.name === name);
	}
}

export const characterDataset = new Dataset(characterStatsDataset);
export const kartDataset = new Dataset(kartStatsDataset);

// Only stats that vary between characters or between vehicles are included.
export const calculatorStats = [
	{ key: 'roadSpeed', label: 'Road speed' },
	{ key: 'terrainSpeed', label: 'Terrain speed' },
	{ key: 'waterSpeed', label: 'Water speed' },
	{ key: 'glidingSpeed', label: 'Gliding speed' },
	{ key: 'acceleration', label: 'Acceleration' },
	{ key: 'miniTurbo', label: 'Mini-turbo' },
	{ key: 'coinCurve', label: 'Coin curve' },
	{ key: 'weight', label: 'Weight' },
	{ key: 'roadHandling', label: 'Road handling' },
	{ key: 'terrainHandling', label: 'Terrain handling' },
	{ key: 'waterHandling', label: 'Water handling' },
	{ key: 'traction', label: 'Traction' },
	{ key: 'invincibility', label: 'Invincibility' }
] as const satisfies readonly { key: Exclude<keyof Stats, 'name'>; label: string }[];
