<script lang="ts">
	import Leaderboard from '$lib/components/custom/Leaderboard.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import StartGPButton from '$lib/components/custom/StartGPButton.svelte';
	import type { PageData } from './$types';
	import Header from './Header.svelte';
	import { api } from '../convex/_generated/api';
	import { useQuery } from 'convex-svelte';
	import { fade } from 'svelte/transition';
	import { cubicIn, cubicInOut } from 'svelte/easing';

	const { data }: { data: PageData } = $props();

	let playerList = useQuery(api.users.getAllUsers, {});

	let loading = $derived([playerList].some((loader) => loader.isLoading));
	let errors = $derived([playerList].map(({ error }) => error).filter((error) => error));

	$inspect(playerList);
	$inspect(loading, errors);
</script>

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if loading}
		<div class="flex h-dvh items-center justify-center">
			<img src="/lapita-logo.png" class="w-48 animate-bounce" alt="lapita-logo" />
		</div>
	{:else}
		{#if errors.length}
			<div>Something went wrong. Looks like this:</div>
			<div class="flex flex-col gap-8">
				{#each errors as error}
					<div class="flex flex-col gap-2">
						<div class="font-medium">{error!.name}</div>
						<div class="text-sm">{error!.message}</div>
						<div class="text-sm">{error!.cause}</div>
						<div class="text-sm">{error!.stack}</div>
					</div>
				{/each}
			</div>
		{:else}{/if}
		<div>
			<Header />
			<div class="mx-auto flex max-w-3xl flex-col items-center gap-2 px-2 py-8">
				<StartGPButton playerList={playerList.data} />
			</div>
		</div>
	{/if}
</div>
