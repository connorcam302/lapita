<script lang="ts">
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import DataTable from './DataTable.svelte';
	import { trackOwnership } from '$lib/track-ownership';
	import TrackOwnership from './TrackOwnership.svelte';
	import { columns } from './columns';

	const trackData = useQuery(api.races.getStats, {});
	const selectedTrack = $derived(
		convexStore.allTracks?.find((track) => track._id === page.url.searchParams.get('track'))
	);
	const ownershipView = $derived(page.url.searchParams.get('view') === 'ownership');
	const filteredTracks = $derived(
		trackData.data?.filter((track) => !selectedTrack || track.trackId === selectedTrack._id)
	);
	function viewHref(ownership: boolean, clearTrack = false) {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (ownership) params.set('view', 'ownership');
		else params.delete('view');
		if (clearTrack) params.delete('track');
		const query = params.toString();
		return `${resolve('/track-stats')}${query ? `?${query}` : ''}`;
	}
	const tableData = $derived(
		trackData.data
			? trackOwnership(filteredTracks ?? []).map((track) => ({
					trackId: track.trackId,
					trackImage: track.trackImg,
					trackName: track.trackName,
					count: track.counts,
					average: Number.isFinite(track.averageParticipants) ? track.averageParticipants : null,
					bestPlayerName:
						track.leaders.map((player) => player.userName).join(' / ') ||
						(track.status === 'unraced' ? 'Unraced' : 'No player with 5 results'),
					bestAverage: track.leaders[0]?.average ?? null,
					bestPlayerId: track.leaders.length === 1 ? track.leaders[0].userId : null,
					gap: track.gap
				}))
			: undefined
	);
</script>

<svelte:head>
	<title>Track Stats · Lapita</title>
	<meta
		name="description"
		content="Compare Lapita tracks, race counts and each track’s leading player."
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="border-b pb-7">
		<h1 class="font-title text-2xl sm:text-3xl">Track stats</h1>
		{#if tableData}
			<p class="text-muted-foreground mt-4 text-sm tabular-nums">
				{tableData.length}
				{tableData.length === 1 ? 'track' : 'tracks'} · {tableData
					.reduce((sum, track) => sum + track.count, 0)
					.toLocaleString()} races scheduled
			</p>
		{/if}
	</header>
	<nav class="mt-6 flex flex-wrap gap-2" aria-label="Track stats views">
		<Button
			href={viewHref(false)}
			variant={ownershipView ? 'outline' : 'secondary'}
			aria-current={!ownershipView ? 'page' : undefined}>Table</Button
		>
		<Button
			href={viewHref(true)}
			variant={ownershipView ? 'secondary' : 'outline'}
			aria-current={ownershipView ? 'page' : undefined}>Ownership grid</Button
		>
	</nav>
	{#if !ownershipView}<StatisticsHelp scope="track" />{/if}

	{#if trackData.error}
		<section class="py-12" role="alert">
			<h2 class="text-xl font-semibold">Could not load track stats</h2>
			<p class="text-muted-foreground mt-2">Check your connection and try again.</p>
			<Button variant="outline" class="mt-4" onclick={trackData.retry}>Try again</Button>
		</section>
	{:else if !tableData}
		<p class="text-muted-foreground py-12" role="status">Loading track stats…</p>
	{:else}
		<section class="mt-6" aria-label="Track comparison">
			{#if !ownershipView || selectedTrack}
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<p class="text-muted-foreground text-sm">
						{selectedTrack
							? `Showing ${selectedTrack.name}`
							: 'All-time stats · Select a track for results and race history.'}
					</p>
					{#if selectedTrack}
						<Button variant="outline" size="sm" href={viewHref(ownershipView, true)}
							>Show all tracks</Button
						>
					{/if}
				</div>
			{/if}
			{#if ownershipView}
				<TrackOwnership data={filteredTracks ?? []} />
			{:else}
				<DataTable {columns} data={tableData} />
				<div class="text-muted-foreground mt-5 grid gap-2 text-sm sm:grid-cols-2 sm:gap-8">
					<p>
						Avg. finishes / race divides recorded finishes by all scheduled races, including those
						with no results.
					</p>
					<p>
						Leaders need at least five valid results on this track. Tied players share the lead.
						Lead gap is the difference to the next player’s average.
					</p>
				</div>
			{/if}
		</section>
	{/if}
</main>
