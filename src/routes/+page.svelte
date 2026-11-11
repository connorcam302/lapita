<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import Header from './Header.svelte';
	import HistoryRow from '$lib/components/custom/HistoryRow.svelte';
	import LatestGrandPrix from './LatestGrandPrix.svelte';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import StartGPButton from '$lib/components/custom/StartGPButton.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { api } from '../convex/_generated/api';
	import { useQuery } from 'convex-svelte';
	import { convexStore } from '$lib/stores/states.svelte';
	import { isComplete } from './home-data';
	import dayjs from 'dayjs';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';

	let pageCount = $state(1);
	const playerList = $derived(convexStore.allUsers ?? []);
	const historyQuery = $derived(useQuery(api.gps.getAll, { pageSize: 12, pageCount }));
	// Keep the current page visible while the expanded live query loads.
	let history = $state<NonNullable<typeof historyQuery.data> | null>(null);
	$effect(() => {
		if (historyQuery.data) history = historyQuery.data;
	});
	let historyScrollPending = $state(false);
	afterNavigate(() => {
		historyScrollPending = page.url.hash === '#history-heading';
	});
	$effect(() => {
		if (historyScrollPending && history) {
			historyScrollPending = false;
			// The history anchor mounts only after the initial query completes.
			void tick().then(() => {
				if (page.url.hash === '#history-heading') {
					document.getElementById('history-heading')?.scrollIntoView();
				}
			});
		}
	});
	const gps = $derived(history?.page ?? []);
	const latest = $derived(gps[0]);
	const months = $derived.by(() => {
		const groups = new SvelteMap<string, typeof gps>();
		for (const gp of gps.slice(1)) {
			const month = dayjs(gp.createdAt).format('MMMM YYYY');
			groups.set(month, [...(groups.get(month) ?? []), gp]);
		}
		return [...groups].map(([month, entries]) => ({ month, entries }));
	});
	const playerName = (id: string) =>
		playerList.find((player) => player._id === id)?.name ?? 'Unknown player';
</script>

<svelte:head>
	<title>Grand Prix · Lapita</title>
	<meta
		name="description"
		content="Grand Prix standings, race history, and player results for your Mario Kart group."
	/>
</svelte:head>

<Header />

<main class="home mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="mb-8 flex flex-wrap items-center justify-between gap-4 sm:mb-10">
		<h1 class="font-title text-2xl sm:text-3xl">Grand Prix</h1>
		<StartGPButton {playerList} />
	</header>

	{#if !history && historyQuery.isLoading}
		<p class="text-muted-foreground py-12" role="status">Loading Grand Prix…</p>
	{:else if !history && historyQuery.error}
		<section class="py-6" role="alert">
			<h2 class="text-xl font-semibold">Could not load race history</h2>
			<p class="text-muted-foreground mt-2">Check your connection and reload the page.</p>
			<Button class="mt-4 shadow-none" variant="outline" onclick={() => window.location.reload()}
				>Reload page</Button
			>
		</section>
	{:else if latest}
		<LatestGrandPrix gp={latest} tracks={convexStore.allTracks ?? []} players={playerList} />
	{:else}
		<p class="text-muted-foreground py-8">No Grand Prix</p>
	{/if}

	{#if gps.length}
		<section aria-labelledby="history-heading" class="mt-10 sm:mt-12">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<Button variant="link" class="order-last px-0" href={resolve('/grandprix')}
					>View all Grand Prix</Button
				>
				<h2 id="history-heading" class="font-body mb-6 text-2xl font-semibold">
					Previous Grand Prix
				</h2>
			</div>
			{#each months as { month, entries } (month)}
				<h3 class="mb-2 text-sm font-semibold">{month}</h3>
				<div class="mb-8">
					{#each entries as gp (gp.grandPrixId)}
						<HistoryRow>
							{#snippet heading()}
								<h4 class="font-body text-xl font-semibold">
									<a
										class="underline-offset-4 hover:underline"
										href={resolve('/grandprix/[id]', { id: gp.grandPrixId })}
										>Grand Prix {gp.order}</a
									>
								</h4>
								<time
									class="text-muted-foreground mt-1 block text-sm"
									datetime={new Date(gp.createdAt).toISOString()}
									>{dayjs(gp.createdAt).format('ddd, D MMM')}</time
								>
							{/snippet}
							<ol
								class="space-y-1.5"
								aria-label={isComplete(gp) ? 'Final leaders' : 'Current leaders'}
							>
								{#each gp.standings.filter((standing) => standing.position <= 3) as standing, i (standing.userId)}
									<li class="flex items-center gap-3 text-sm">
										<PositionBadge position={standing.position} />
										<a
											href={resolve('/players/[userId]', { userId: standing.userId })}
											class="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
											>{playerName(standing.userId)}</a
										>
										<span class="flex items-baseline gap-2 tabular-nums">
											{#if i > 0}
												<span class="text-red-600 dark:text-red-400">
													<span class="sr-only">Gap to racer above: </span>(−{gp.standings[i - 1]
														.points - standing.points})
												</span>
											{/if}
											<span>{standing.points} <span class="text-muted-foreground">pts</span></span>
										</span>
									</li>
								{/each}
							</ol>
							{#snippet status()}
								<p>
									{isComplete(gp)
										? 'Complete'
										: `${gp.completedRaces}/${gp.raceCount} races complete`}<span class="mt-1 block"
										>{gp.standings.length} racers</span
									>
								</p>
							{/snippet}
						</HistoryRow>
					{/each}
				</div>
			{/each}
			{#if !months.length}<p class="text-muted-foreground mb-6 text-sm">
					No previous Grand Prix
				</p>{/if}
			{#if historyQuery.error}<p role="alert" class="mb-4 text-sm">
					Could not load history updates. Check your connection and try again.
				</p>{/if}
			<div aria-live="polite">
				{#if history?.hasMore || historyQuery.error}<Button
						variant="outline"
						class="shadow-none"
						disabled={historyQuery.isLoading}
						onclick={() => pageCount++}
						>{historyQuery.isLoading
							? 'Loading history…'
							: historyQuery.error
								? 'Try again'
								: 'Load more Grand Prix'}</Button
					>{:else}<p class="text-muted-foreground text-sm">All Grand Prix loaded</p>{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	.home :global(a:focus-visible),
	.home :global(button:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 4px;
	}
	.home :global(::selection) {
		background: var(--color-lapita);
		color: #171717;
	}
</style>
