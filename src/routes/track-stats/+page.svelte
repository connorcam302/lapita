<script lang="ts">
	import { convexStore } from '$lib/stores/states.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import DataTable from './DataTable.svelte';
	import { columns } from './columns';
	import { cubicIn } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	import * as Card from '$lib/components/ui/card/index.js';

	let allTracks = $derived(convexStore.allTracks);

	let trackData = $derived(useQuery(api.races.getStats, {}));

	let tableData = $derived(
		trackData?.data?.map((track) => ({
			trackImage: track.trackImg,
			trackName: track.trackName,
			count: track.counts,
			average: track.averageParticipants,
			bestPlayerName: track.userAverages[0].userName,
			bestAverage: track.userAverages[0].average,
			bestPlayerId: track.userAverages[0].userId,
			gap: -1 * (track.userAverages[0].average - track.userAverages[1].average)
		}))
	);

	$inspect(trackData);
	$inspect(tableData);

	// Initial loading (only show spinner on first load)
	let initialLoading = $derived(!tableData);
	let errors = $derived([trackData].map(({ error }) => error).filter((error) => error));
</script>

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if initialLoading}
		<div class="flex h-dvh items-center justify-center">
			<img src="/lapita-logo.png" class="w-48 animate-bounce" alt="lapita-logo" />
		</div>
	{:else if errors.length}
		<div>Something went wrong. Looks like this:</div>
		<div class="flex flex-col gap-8">
			{#each errors as error, i (i)}
				<div class="flex flex-col gap-2">
					<div class="font-medium">{error!.name}</div>
					<div class="text-sm">{error!.message}</div>
					<div class="text-sm">{error!.cause}</div>
					<div class="text-sm">{error!.stack}</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="mx-auto max-w-5xl py-4">
			<Card.Root class="w-full">
				<Card.Header>
					<Card.Title>Track Stats</Card.Title>
					<Card.Description>Tracks and their stats</Card.Description>
				</Card.Header>
				<Card.Content>
					<DataTable {columns} data={tableData} />
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
