import { convexUrl } from '$lib/convex-url';
import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

type TracksData = Awaited<FunctionReturnType<typeof api.tracks.all>>;
type CharacterData = Awaited<FunctionReturnType<typeof api.characters.all>>;
type KartsData = Awaited<FunctionReturnType<typeof api.karts.all>>;
type UserData = Awaited<FunctionReturnType<typeof api.users.getAllUsers>>;

class ConvexStore {
	allKarts: KartsData | null = $state(null);
	allCharacters: CharacterData | null = $state(null);
	allUsers: UserData | null = $state(null);
	allTracks: TracksData | null = $state(null);

	get isLoaded(): boolean {
		return (
			this.allKarts !== null &&
			this.allCharacters !== null &&
			this.allUsers !== null &&
			this.allTracks !== null
		);
	}

	client = new ConvexClient(convexUrl);

	constructor() {
		this.loadData(); // Load data immediately when store is created
	}

	async loadData() {
		const [characterList, kartList, playerList, trackList] = await Promise.all([
			this.client.query(api.characters.all, {}),
			this.client.query(api.karts.all, {}),
			this.client.query(api.users.getAllUsers, {}),
			this.client.query(api.tracks.all, {})
		]);

		this.allCharacters = characterList;
		this.allKarts = kartList;
		this.allUsers = playerList;
		this.allTracks = trackList;
	}
}

export const convexStore = new ConvexStore();
