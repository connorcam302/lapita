import characterStatsDataset from './characterStats.json';
import kartStatsDataset from './kartsStats.json';

// Define the character stats interface
interface Stats {
	name: string;
	roadSpeed: number;
	terrainSpeed: number;
	waterSpeed: number;
	acceleration: number;
	weight: number;
	roadHandling: number;
	terrainHandling: number;
	waterHandling: number;
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
