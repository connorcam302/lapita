import type { FunctionReturnType } from 'convex/server';
import { api } from '../../convex/_generated/api';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { ConvexClient } from 'convex/browser';

type TracksData = Awaited<FunctionReturnType<typeof api.tracks.all>>;
type CharacterData = Awaited<FunctionReturnType<typeof api.characters.all>>;
type KartsData = Awaited<FunctionReturnType<typeof api.karts.all>>;
type UserData = Awaited<FunctionReturnType<typeof api.users.getAllUsers>>;

const client = new ConvexClient(PUBLIC_CONVEX_URL);
const characterList = await client.query(api.characters.all, {});
const kartList = await client.query(api.karts.all, {});
const playerList = await client.query(api.users.getAllUsers, {});
const trackList = await client.query(api.tracks.all, {});

export let allKarts: KartsData | null = $state(kartList);
export let allCharacters: CharacterData | null = $state(characterList);
export let allUsers: UserData | null = $state(playerList);
export let allTracks: TracksData | null = $state(trackList);
