<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import { parseRivalryScope, rivalryScopes, type RivalryScope } from '$lib/rivalry';
	import { getTrackName } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import RivalryChart from './RivalryChart.svelte';
	const players = $derived(
		[...(convexStore.allUsers ?? [])].sort((a, b) => a.name.localeCompare(b.name))
	);
	const a = $derived(players.find((p) => p._id === page.url.searchParams.get('a')));
	const b = $derived(players.find((p) => p._id === page.url.searchParams.get('b')));
	const scope = $derived(parseRivalryScope(page.url.searchParams.get('scope')));
	const validPair = $derived(a && b && a._id !== b._id);
	const rivalry = useQuery(api.rivalry.get, () =>
		validPair && a && b ? { playerA: a._id, playerB: b._id, scope } : 'skip'
	);
	const stats = $derived(rivalry.data);
	let limit = $state(12);
	afterNavigate(() => {
		limit = 12;
	});
	const scopeLabels: Record<RivalryScope, string> = {
		all: 'All time',
		'5': 'Latest 5 GPs',
		'10': 'Latest 10 GPs',
		'20': 'Latest 20 GPs'
	};
	function update(key: string, value: string) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		params.set(key, value);
		params.set('scope', key === 'scope' ? value : scope);
		// The route is resolved before appending URL state.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(`${resolve('/rivalry')}?${params}`, { noScroll: true, keepFocus: true });
	}
	const percentage = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);
</script>

<svelte:head>
	<title>{a && b ? `${a.name} vs ${b.name}` : 'Head-to-head rivalry'} · Lapita</title>
	<meta
		name="description"
		content="Compare two Lapita racers across shared races, recent results and track-by-track advantages."
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="mb-7">
		<h1 class="font-title text-2xl sm:text-3xl">Head-to-head rivalry</h1>
		<p class="text-muted-foreground mt-3 max-w-prose text-sm">
			Choose two racers to compare their finishes in the same races.
		</p>
	</header>
	<div class="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-3 sm:p-5">
		{#each [{ key: 'a', label: 'First player', selected: a, other: b }, { key: 'b', label: 'Second player', selected: b, other: a }] as field (field.key)}
			<div class="min-w-0">
				<label for={`rivalry-${field.key}`} class="mb-2 block text-sm font-medium"
					>{field.label}</label
				>
				<select
					id={`rivalry-${field.key}`}
					value={field.selected?._id ?? ''}
					onchange={(e) => update(field.key, e.currentTarget.value)}
					class="bg-background border-input focus-visible:ring-ring h-11 w-full min-w-0 rounded-md border px-3 text-sm focus-visible:ring-2"
				>
					<option value="">Choose a player</option>
					{#each players as player (player._id)}<option
							value={player._id}
							disabled={player._id === field.other?._id}>{player.name}</option
						>{/each}
				</select>
			</div>
		{/each}
		<div>
			<label for="rivalry-scope" class="mb-2 block text-sm font-medium">Scope</label>
			<select
				id="rivalry-scope"
				value={scope}
				onchange={(e) => update('scope', e.currentTarget.value)}
				class="bg-background border-input focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm focus-visible:ring-2"
			>
				{#each rivalryScopes as value (value)}<option {value}>{scopeLabels[value]}</option>{/each}
			</select>
		</div>
	</div>
	<p class="text-muted-foreground mt-3 max-w-prose text-xs">
		Recent scopes use the latest non-deleted Grand Prix across Lapita by GP number, including those
		in progress, whether or not both players entered.
	</p>
	{#if !validPair}
		<section class="py-12" role="status">
			<h2 class="font-title text-lg">
				{a && b ? 'Choose two different players' : 'Pick your rivals'}
			</h2>
			<p class="text-muted-foreground mt-3">
				Select two different players above. Missing or outdated player links can be replaced using
				the selectors.
			</p>
			{#if players.length < 2}<p class="text-muted-foreground mt-3">
					At least two players are needed to compare a rivalry.
				</p>{/if}
		</section>
	{:else if rivalry.error}
		<section class="py-12" role="alert">
			<h2 class="font-title text-lg">Could not load this rivalry</h2>
			<p class="text-muted-foreground mt-3">Check your connection and try again.</p>
			<Button class="mt-4" variant="outline" onclick={rivalry.retry}>Try again</Button>
		</section>
	{:else if !stats || rivalry.isLoading}
		<p role="status" class="text-muted-foreground py-12">Loading shared races…</p>
	{:else if a && b}
		<section class="mt-8" aria-labelledby="comparison-heading">
			<h2 id="comparison-heading" class="font-title text-xl">{a.name} vs {b.name}</h2>
			<p class="text-muted-foreground mt-2 text-sm">
				{scopeLabels[scope]} · {stats.count} shared {stats.count === 1 ? 'race' : 'races'} · {stats.ties}
				{stats.ties === 1 ? 'tie' : 'ties'}
			</p>
			<div class="bg-card mt-5 overflow-x-auto rounded-xl border">
				<Table.Root
					><Table.Caption class="sr-only">Shared-race comparison</Table.Caption><Table.Header
						><Table.Row
							><Table.Head>Metric</Table.Head><Table.Head class="text-right">{a.name}</Table.Head
							><Table.Head class="text-right">{b.name}</Table.Head></Table.Row
						></Table.Header
					><Table.Body>
						{#each [['Finishes ahead', stats.aAhead, stats.bAhead], ['Head-to-head %', percentage(stats.aPercent), percentage(stats.bPercent)], ['Average finish', stats.aAverage?.toFixed(2) ?? '—', stats.bAverage?.toFixed(2) ?? '—'], ['Points earned', stats.aPoints, stats.bPoints]] as row (row[0])}
							<Table.Row
								><Table.Cell class="font-medium">{row[0]}</Table.Cell><Table.Cell
									class="text-right tabular-nums">{row[1]}</Table.Cell
								><Table.Cell class="text-right tabular-nums">{row[2]}</Table.Cell></Table.Row
							>
						{/each}
					</Table.Body></Table.Root
				>
			</div>
			<StatisticsHelp scope="rivalry" />
		</section>
		{#if stats.count === 0}
			<section class="py-12" role="status">
				<h2 class="font-title text-lg">No shared finishes in this scope</h2>
				<p class="text-muted-foreground mt-3">
					Try all time or another rival. Results will appear once both racers have a valid finish in
					the same race.
				</p>
			</section>
		{:else}
			<div class="mt-8"><RivalryChart data={stats} aName={a.name} bName={b.name} /></div>
			<section class="mt-10" aria-labelledby="track-advantages-heading">
				<h2 id="track-advantages-heading" class="font-title text-lg">Track-by-track advantages</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Advantage is the difference in finishes ahead. Tracks use the race’s end track, including
					transitions. Largest samples first.
				</p>
				<div class="bg-card mt-5 overflow-x-auto rounded-xl border">
					<Table.Root class="min-w-[700px]"
						><Table.Header
							><Table.Row
								><Table.Head>Track</Table.Head><Table.Head class="text-right"
									>Shared races</Table.Head
								><Table.Head class="text-right">{a.name} ahead</Table.Head><Table.Head
									class="text-right">{b.name} ahead</Table.Head
								><Table.Head class="text-right">Ties</Table.Head><Table.Head>Advantage</Table.Head
								></Table.Row
							></Table.Header
						><Table.Body>
							{#each stats.tracks as track (track.trackId)}<Table.Row
									><Table.Cell
										><a
											class="rounded-sm underline-offset-4 hover:underline focus-visible:ring-2"
											href={resolve('/tracks/[trackId]', { trackId: track.trackId })}
											>{getTrackName(convexStore.allTracks ?? [], track.trackId)}</a
										></Table.Cell
									><Table.Cell class="text-right tabular-nums">{track.count}</Table.Cell><Table.Cell
										class="text-right tabular-nums">{track.aAhead}</Table.Cell
									><Table.Cell class="text-right tabular-nums">{track.bAhead}</Table.Cell
									><Table.Cell class="text-right tabular-nums">{track.ties}</Table.Cell><Table.Cell
										>{track.aAhead === track.bAhead
											? 'Level'
											: `${track.aAhead > track.bAhead ? a.name : b.name} +${Math.abs(track.aAhead - track.bAhead)}`}</Table.Cell
									></Table.Row
								>{/each}
						</Table.Body></Table.Root
					>
				</div>
			</section>
			<section class="mt-10" aria-labelledby="recent-rivalry-heading">
				<h2 id="recent-rivalry-heading" class="font-title text-lg">Recent head-to-head results</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Newest GP and race first. Select a race to open its results.
				</p>
				<div class="bg-card mt-5 overflow-x-auto rounded-xl border">
					<Table.Root class="min-w-[620px]"
						><Table.Header
							><Table.Row
								><Table.Head>Race</Table.Head><Table.Head>Track</Table.Head><Table.Head
									class="text-right">{a.name}</Table.Head
								><Table.Head class="text-right">{b.name}</Table.Head><Table.Head>Ahead</Table.Head
								></Table.Row
							></Table.Header
						><Table.Body>
							{#each stats.races.slice().reverse().slice(0, limit) as race (race.raceId)}<Table.Row
									><Table.Cell
										><a
											class="rounded-sm underline-offset-4 hover:underline focus-visible:ring-2"
											href={resolve(`/grandprix/[id]?track=${race.raceId}`, {
												id: race.grandPrixId
											})}>GP {race.gpOrder} · Race {race.raceOrder + 1}</a
										></Table.Cell
									><Table.Cell>{getTrackName(convexStore.allTracks ?? [], race.trackId)}</Table.Cell
									><Table.Cell class="text-right"
										><PositionBadge position={race.aPosition} /></Table.Cell
									><Table.Cell class="text-right"
										><PositionBadge position={race.bPosition} /></Table.Cell
									><Table.Cell
										>{race.aPosition === race.bPosition
											? 'Tie'
											: race.aPosition < race.bPosition
												? a.name
												: b.name}</Table.Cell
									></Table.Row
								>{/each}
						</Table.Body></Table.Root
					>
				</div>
				<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
					<p class="text-muted-foreground text-sm">
						Showing {Math.min(limit, stats.count)} of {stats.count} shared races
					</p>
					{#if limit < stats.count}<Button variant="outline" onclick={() => (limit += 12)}
							>Show more results</Button
						>{/if}
				</div>
			</section>
		{/if}
	{/if}
</main>
