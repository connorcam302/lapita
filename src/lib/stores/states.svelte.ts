import { PUBLIC_CONVEX_URL } from '$env/static/public';
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

	client = new ConvexClient(PUBLIC_CONVEX_URL);

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
