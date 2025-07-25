import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { getAllGpStandings } from '$lib/server/serverUtils';
import { getAllUsers } from '../convex/users';
import { query } from '../convex/_generated/server';
import { ConvexClient } from 'convex/browser';
import { PUBLIC_CONVEX_URL } from '$env/static/public';
import { api } from '../convex/_generated/api';
import { allUsers } from '$lib/stores/states.svelte';
import { setContext } from 'svelte';

export const load: PageServerLoad = async () => {
	const client = new ConvexClient(PUBLIC_CONVEX_URL);

	return {};
};
