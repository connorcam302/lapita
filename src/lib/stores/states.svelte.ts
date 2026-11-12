import { browser } from '$app/environment';
import { QueryResource } from '$lib/query-resource';
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

	isLoading = $state(false);
	error = $state(false);

	private resource = new QueryResource<[CharacterData, KartsData, UserData, TracksData]>(
		(success, failure) => {
			let active = true;
			Promise.all([
				this.client.query(api.characters.all, {}),
				this.client.query(api.karts.all, {}),
				this.client.query(api.users.getAllUsers, {}),
				this.client.query(api.tracks.all, {})
			]).then(
				(data) => {
					if (active) success(data);
				},
				() => {
					if (active) failure();
				}
			);
			return () => {
				active = false;
			};
		},
		({ data, error, isLoading }) => {
			this.error = error;
			this.isLoading = isLoading;
			if (data) {
				const [characters, karts, users, tracks] = data;
				this.allCharacters = characters;
				this.allKarts = karts;
				this.allUsers = users;
				this.allTracks = tracks;
			}
		}
	);

	constructor() {
		if (browser) this.loadData();
	}

	loadData() {
		if (!this.isLoading) this.resource.start();
	}
}

export const convexStore = new ConvexStore();
