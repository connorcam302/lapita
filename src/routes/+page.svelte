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
	import { cubicIn } from 'svelte/easing';
	import type { FunctionReturnType } from 'convex/server';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getPlayerName } from '$lib/utils';
	import { convexStore } from '$lib/stores/states.svelte';

	let playerList = $derived(convexStore.allUsers);

	$inspect(convexStore.isLoaded);
	$inspect(convexStore);

	let pageCount = $state(1);
	let displayedGps: Awaited<FunctionReturnType<typeof api.gps.getAll>>['page'] = $state([]);
	let isLoadingMore = $state(false);

	// Always query with the current pageCount - this gets ALL data up to pageCount
	let allGpsQuery = $derived(useQuery(api.gps.getAll, { pageSize: 10, pageCount }));

	// Initial loading (only show spinner on first load)
	let initialLoading = $derived(!playerList || (pageCount === 1 && allGpsQuery.isLoading));
	let errors = $derived([allGpsQuery].map(({ error }) => error).filter((error) => error));

	// Update displayed GPS when new data arrives
	$effect(() => {
		if (!allGpsQuery.isLoading && allGpsQuery.data?.page) {
			// Always update with the full dataset
			displayedGps = allGpsQuery.data.page;

			// If we were loading more, stop the loading state
			if (isLoadingMore) {
				isLoadingMore = false;
			}
		}
	});

	// Load more function - simply increment pageCount
	function loadMore() {
		if (isLoadingMore || allGpsQuery.isLoading) return;
		isLoadingMore = true;
		pageCount++; // This will trigger a new query
	}
</script>

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if initialLoading}
		<div class="flex h-dvh items-center justify-center">
			<img src="/lapita-logo.png" class="w-48 animate-bounce" alt="lapita-logo" />
		</div>
	{:else if errors.length}
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
	{:else}
		<div>
			<Header />
			<div class="flex flex-col gap-8 pb-8">
				<div class="mx-auto flex max-w-3xl flex-col items-center gap-2 px-2 py-8">
					<StartGPButton {playerList} />
				</div>

				<div class="flex flex-col items-center justify-center gap-4">
					{#each displayedGps as { order, grandPrixId, standings } (grandPrixId)}
						<a href={`/grandprix/${grandPrixId}`}>
							<Card.Root class="w-96 cursor-pointer">
								<Card.Header>
									<Card.Title>Grand Prix {order}</Card.Title>
								</Card.Header>
								<Card.Content>
									<div class="flex flex-col">
										{#each standings as { userId, points, position }, i (userId + grandPrixId)}
											<div>
												{#if i !== 0}
													{@const gap = points - standings[i - 1].points}
													<Separator class="my-2" />
													<div class="flex justify-between">
														<div>{position}. {getPlayerName(playerList, userId)}</div>
														<div class="flex gap-2">
															{#if gap !== 0}
																<div class="text-red-400">({gap})</div>
															{/if}
															{points}
														</div>
													</div>
												{:else}
													<div class="flex justify-between">
														<div class="font-medium">
															{position}. {getPlayerName(playerList, userId)}
														</div>
														<div>{points}</div>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</Card.Content>
							</Card.Root>
						</a>
					{/each}
				</div>
				<div
					class="flex items-center justify-center"
					transition:fade|global={{ duration: 500, easing: cubicIn }}
				>
					{#if isLoadingMore || allGpsQuery.isLoading}
						<img src="/lapita-logo.png" class="w-16 animate-bounce" alt="lapita-logo" />
					{:else}
						<Button
							variant="outline"
							onclick={loadMore}
							disabled={isLoadingMore || allGpsQuery.isLoading}
						>
							Load More
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
