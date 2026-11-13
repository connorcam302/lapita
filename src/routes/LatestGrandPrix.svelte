<script lang="ts">
	import KnockoutScoreMark from '$lib/components/custom/KnockoutScoreMark.svelte';
	import EraTag from '$lib/components/custom/EraTag.svelte';
	import { resolve } from '$app/paths';
	import { ArrowRight } from '@lucide/svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../convex/_generated/api';
	import type { Doc } from '../convex/_generated/dataModel';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import { getRaceContext, isComplete } from './home-data';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import dayjs from 'dayjs';

	let {
		gp,
		tracks,
		players
	}: {
		gp: FunctionReturnType<typeof api.gps.getAll>['page'][number];
		tracks: Doc<'tracks'>[];
		players: Doc<'users'>[];
	} = $props();

	const complete = $derived(isComplete(gp));
	const raceQuery = useQuery(api.races.inGrandPrix, () => ({ grandPrixId: gp.grandPrixId }));
	const context = $derived(getRaceContext(raceQuery.data ?? [], gp.nextRaceId, complete));
	const currentTrack = $derived(tracks.find((track) => track._id === context.current?.trackEndId));
	const previousTrack = $derived(
		tracks.find((track) => track._id === context.previous?.trackEndId)
	);
	const started = $derived(gp.completedRaces > 0);
	const href = $derived(
		resolve(`/grandprix/${gp.grandPrixId}${gp.nextRaceId ? `?track=${gp.nextRaceId}` : ''}`)
	);
</script>

<section class="bg-card overflow-hidden rounded-md border" aria-labelledby="latest-heading">
	<header class="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:px-6">
		<div>
			<div class="flex flex-wrap items-center gap-3">
				<h2 id="latest-heading" class="font-body text-3xl font-semibold">Grand Prix {gp.order}</h2>
				<span class="bg-muted text-muted-foreground rounded-sm px-2 py-1 text-xs font-medium">
					{complete ? 'Complete' : started ? 'In progress' : 'Not started'}
				</span>
			</div>
			<EraTag era={gp.era} />
			<p class="text-muted-foreground mt-1.5 text-sm">
				<time datetime={new Date(gp.createdAt).toISOString()}
					>{dayjs(gp.createdAt).format('D MMM YYYY')}</time
				>
				<span class="mx-2" aria-hidden="true">·</span>{gp.standings.length} racers
			</p>
		</div>
		<div class="flex w-full flex-wrap gap-2 sm:w-auto">
			{#if complete}
				<Button
					variant="secondary"
					size="lg"
					href={resolve('/grandprix/[id]/recap', { id: gp.grandPrixId })}>View recap</Button
				>
			{/if}
			<Button
				{href}
				variant={complete ? 'outline' : 'secondary'}
				size="lg"
				class="h-11 w-full shadow-none sm:w-auto"
			>
				{complete ? 'View results' : started ? 'Continue Grand Prix' : 'Start racing'}
				<ArrowRight aria-hidden="true" />
			</Button>
		</div>
	</header>

	<div class="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
		<div class="border-b p-5 sm:p-6 md:border-r md:border-b-0">
			{#if raceQuery.error}
				<p class="text-muted-foreground text-sm" role="alert">
					Could not load tracks. Check your connection and try again.
				</p>
				<Button variant="outline" size="sm" onclick={raceQuery.retry}>Try again</Button>
			{:else if raceQuery.isLoading}
				<p class="text-muted-foreground text-sm" role="status">Loading tracks…</p>
			{:else}
				{#if currentTrack}
					<img
						class="bg-muted aspect-[16/7] w-full rounded-sm object-cover"
						src={`/tracks/locations/${currentTrack.img}.jpg`}
						alt={currentTrack.name}
					/>
				{/if}
				<div class="mt-4 grid grid-cols-2 gap-4">
					{#each [{ label: 'Previous track', track: previousTrack, empty: context.previous ? 'Track unavailable' : 'No previous race' }, { label: 'Current track', track: currentTrack, empty: context.current ? 'Track unavailable' : 'No current race' }] as item (item.label)}
						<div class="min-w-0">
							<p class="text-muted-foreground mb-2 text-xs">{item.label}</p>
							{#if item.track}
								<img
									class="mb-2 size-12 object-contain"
									src={`/tracks/icons/${item.track.img}.png`}
									alt=""
								/>
								<p class="font-body text-lg font-semibold">{item.track.name}</p>
							{:else}
								<p class="text-muted-foreground text-sm">{item.empty}</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			<div class="mt-5">
				<p class="mb-2 flex items-baseline justify-between gap-3 text-sm">
					<span class="text-muted-foreground">Races complete</span>
					<span class="font-medium tabular-nums"
						>{gp.completedRaces}
						<span class="text-muted-foreground font-normal">/ {gp.raceCount}</span></span
					>
				</p>
				<Progress
					value={gp.completedRaces}
					max={Math.max(1, gp.raceCount)}
					class="bg-muted [&_[data-slot=progress-indicator]]:bg-lapita h-2 rounded-sm motion-reduce:[&_[data-slot=progress-indicator]]:transition-none"
					aria-label="Races complete"
				/>
			</div>
		</div>

		<div class="min-w-0 p-5 sm:p-6">
			<h3 class="font-body text-xl font-semibold">
				{complete ? 'Final standings' : 'Current standings'}
			</h3>
			{#if gp.standings.length}
				<div
					class="text-muted-foreground mt-4 grid grid-cols-[minmax(0,1fr)_3rem_4rem] gap-3 border-b pb-2 text-xs"
					aria-hidden="true"
				>
					<span>Racer</span><span class="text-right">Gap</span><span class="text-right">Points</span
					>
				</div>
				<ol class="divide-y">
					{#each gp.standings as standing, i (standing.userId)}
						<li class="grid grid-cols-[minmax(0,1fr)_3rem_4rem] items-center gap-3 py-2.5 text-sm">
							<div class="flex min-w-0 items-center gap-3">
								<PositionBadge position={standing.position} />
								<a
									href={resolve('/players/[userId]', { userId: standing.userId })}
									class="truncate underline-offset-4 hover:underline"
									class:font-semibold={standing.position === 1}
								>
									{players.find((player) => player._id === standing.userId)?.name ??
										'Unknown player'}
								</a>
							</div>
							<span class="text-right text-xs tabular-nums">
								{#if i > 0}
									<span class="text-red-600 dark:text-red-400"
										><span class="sr-only">Points behind racer above: </span>−{gp.standings[i - 1]
											.points - standing.points}</span
									>
								{:else}<span class="text-muted-foreground" aria-hidden="true">—</span>{/if}
							</span>
							<span class="text-right font-medium tabular-nums"
								>{standing.points}<KnockoutScoreMark
									won={gp.knockoutWinnerId === standing.userId}
								/><span class="sr-only"> points</span></span
							>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-muted-foreground mt-4 text-sm">No standings yet</p>
			{/if}
		</div>
	</div>
</section>
