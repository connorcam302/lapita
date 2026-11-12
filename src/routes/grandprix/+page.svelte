<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import { filterArchive, type ArchiveFilters } from '$lib/gp-archive';
	import HistoryRow from '$lib/components/custom/HistoryRow.svelte';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import dayjs from 'dayjs';
	import SetEra from '$lib/components/custom/SetEra.svelte';
	import EraTag from '$lib/components/custom/EraTag.svelte';

	const archive = useQuery(api.gps.archive, {});
	const players = $derived(
		[...(convexStore.allUsers ?? [])].sort((a, b) => a.name.localeCompare(b.name))
	);
	const tracks = $derived(
		[...(convexStore.allTracks ?? [])].sort((a, b) => a.name.localeCompare(b.name))
	);
	const filters: ArchiveFilters = $derived(
		Object.fromEntries(
			['era', 'q', 'status', 'player', 'winner', 'track', 'from', 'to', 'sort'].map((key) => [
				key,
				page.url.searchParams.get(key) ?? ''
			])
		) as ArchiveFilters
	);
	const eras = $derived(
		[...new Set((archive.data ?? []).flatMap((gp) => (gp.era ? [gp.era] : [])))].sort()
	);
	const matches = $derived(filterArchive(archive.data ?? [], filters, players));
	let visibleCount = $state(24);
	afterNavigate(() => {
		visibleCount = 24;
	});
	const name = (id: string) =>
		players.find((player) => player._id === id)?.name ?? 'Unknown player';
	async function apply(event: SubmitEvent) {
		event.preventDefault();
		const data = new FormData(event.currentTarget as HTMLFormElement);
		const params = new SvelteURLSearchParams();
		for (const [key, value] of data)
			if (String(value).trim()) params.set(key, String(value).trim());
		// The route is resolved before appending the shareable filter parameters.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`${resolve('/grandprix')}?${params}`, { keepFocus: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>All Grand Prix · Lapita</title>
	<meta
		name="description"
		content="Explore every Lapita Grand Prix. Search and filter by player, winner, track, status and date."
	/>
</svelte:head>

<main class="archive mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="mb-7 flex flex-wrap items-center justify-between gap-3">
		<h1 class="font-title text-2xl sm:text-3xl">All Grand Prix</h1>
		<SetEra />
	</header>
	<form onsubmit={apply} class="bg-card rounded-md border p-4 sm:p-5">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="sm:col-span-2">
				<label for="gp-search" class="mb-2 block text-sm font-medium">Search Grand Prix</label>
				<Input
					id="gp-search"
					name="q"
					type="search"
					value={filters.q}
					placeholder="GP number, player or era"
				/>
			</div>
			<div>
				<label for="gp-status" class="mb-2 block text-sm font-medium">Status</label>
				<select id="gp-status" name="status" value={filters.status}
					><option value="">All statuses</option><option value="complete">Complete</option><option
						value="in-progress">In progress</option
					></select
				>
			</div>
			<div>
				<label for="gp-sort" class="mb-2 block text-sm font-medium">Sort by</label>
				<select id="gp-sort" name="sort" value={filters.sort}
					><option value="">Newest first</option><option value="oldest">Oldest first</option
					></select
				>
			</div>
			{#each [{ key: 'player', label: 'Participant', empty: 'All players' }, { key: 'winner', label: 'Winner', empty: 'All winners' }] as field (field.key)}
				<div>
					<label for={`gp-${field.key}`} class="mb-2 block text-sm font-medium">{field.label}</label
					>
					<select
						id={`gp-${field.key}`}
						name={field.key}
						value={filters[field.key as 'player' | 'winner']}
						><option value="">{field.empty}</option>{#each players as player (player._id)}<option
								value={player._id}>{player.name}</option
							>{/each}</select
					>
				</div>
			{/each}
			<div class="sm:col-span-2">
				<label for="gp-era" class="mb-2 block text-sm font-medium">Era</label>
				<select id="gp-era" name="era" value={filters.era ?? ''}>
					<option value="">All eras</option>
					{#if filters.era && !eras.includes(filters.era)}<option value={filters.era}
							>{filters.era}</option
						>{/if}
					{#each eras as era (era)}<option value={era}>{era}</option>{/each}
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="gp-track" class="mb-2 block text-sm font-medium">Track</label>
				<select id="gp-track" name="track" value={filters.track}
					><option value="">All tracks</option>{#each tracks as track (track._id)}<option
							value={track._id}>{track.name}</option
						>{/each}</select
				>
			</div>
			<div>
				<label for="gp-from" class="mb-2 block text-sm font-medium">From</label>
				<Input id="gp-from" name="from" type="date" value={filters.from} />
			</div>
			<div>
				<label for="gp-to" class="mb-2 block text-sm font-medium">To</label>
				<Input
					id="gp-to"
					name="to"
					type="date"
					value={filters.to}
					min={filters.from || undefined}
				/>
			</div>
			<div class="flex flex-wrap items-end gap-3 sm:col-span-2">
				<Button type="submit" variant="secondary">Apply filters</Button>
				<Button href={resolve('/grandprix')} variant="ghost">Clear filters</Button>
			</div>
		</div>
		<p class="text-muted-foreground mt-4 text-xs">
			Winners include tied first places in completed Grand Prix. Track matches either end of a
			transition.
		</p>
	</form>

	{#if archive.error}
		<section class="py-10" role="alert">
			<h2 class="text-xl font-semibold">Could not load Grand Prix</h2>
			<p class="text-muted-foreground mt-2">Check your connection and try again.</p>
			<Button variant="outline" class="mt-4" onclick={archive.retry}>Try again</Button>
		</section>
	{:else if !archive.data}
		<p class="text-muted-foreground py-10" role="status">Loading all Grand Prix…</p>
	{:else}
		<p class="text-muted-foreground mt-7 mb-2 text-sm tabular-nums" role="status">
			{matches.length} of {archive.data.length} Grand Prix · Showing {Math.min(
				visibleCount,
				matches.length
			)}
		</p>
		{#each matches.slice(0, visibleCount) as gp (gp.grandPrixId)}
			<HistoryRow>
				{#snippet heading()}
					<h2 class="font-body text-xl font-semibold">
						<a
							class="underline-offset-4 hover:underline"
							href={resolve('/grandprix/[id]', { id: gp.grandPrixId })}>Grand Prix {gp.order}</a
						>
					</h2>
					<EraTag era={gp.era} />
					<time
						class="text-muted-foreground mt-1 block text-sm"
						datetime={new Date(gp.createdAt).toISOString()}
						>{dayjs(gp.createdAt).format('ddd, D MMM YYYY')}</time
					>
					<p class="text-muted-foreground mt-1 text-sm">{gp.participants.length} racers</p>
				{/snippet}
				<ol
					class="space-y-1.5"
					aria-label={gp.status === 'complete' ? 'Final leaders' : 'Current leaders'}
				>
					{#each gp.standings.filter((standing) => standing.position <= 3) as standing (standing.userId)}
						<li class="flex items-center gap-3 text-sm">
							<PositionBadge position={standing.position} />
							<a
								class="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
								href={resolve('/players/[userId]', { userId: standing.userId })}
								>{name(standing.userId)}</a
							>
							<span class="tabular-nums"
								>{standing.points} <span class="text-muted-foreground">pts</span></span
							>
						</li>
					{/each}
				</ol>
				{#snippet status()}
					<p class="text-foreground font-medium">
						{gp.status === 'complete' ? 'Complete' : 'In progress'}
					</p>
					<p class="mt-1 tabular-nums">{gp.completedRaces}/{gp.raceCount} races complete</p>
				{/snippet}
			</HistoryRow>
		{:else}
			<section class="py-12">
				<h2 class="text-xl font-semibold">
					{archive.data.length ? 'No matching Grand Prix' : 'No Grand Prix yet'}
				</h2>
				<p class="text-muted-foreground mt-2">
					{archive.data.length
						? 'Try a different search or clear the filters to see every Grand Prix.'
						: 'Start a Grand Prix from the home page to see it here.'}
				</p>
				<Button
					class="mt-4"
					variant="outline"
					href={archive.data.length ? resolve('/grandprix') : resolve('/')}
					>{archive.data.length ? 'Clear filters' : 'Go to home'}</Button
				>
			</section>
		{/each}
		{#if matches.length > visibleCount}<Button
				class="mt-6"
				variant="outline"
				onclick={() => (visibleCount += 24)}>Show more Grand Prix</Button
			>{/if}
	{/if}
</main>

<style>
	select {
		width: 100%;
		min-width: 0;
		height: 2.25rem;
		border: 1px solid var(--input);
		border-radius: var(--radius);
		background: var(--background);
		color: var(--foreground);
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}
	.archive :global(a:focus-visible),
	.archive :global(select:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 4px;
	}
</style>
