<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';
	import { Button } from '$lib/components/ui/button';
	import DataTable from './DataTable.svelte';
	import { columns } from './columns';

	const trackData = useQuery(api.races.getStats, {});
	const selectedTrack = $derived(
		convexStore.allTracks?.find((track) => track._id === page.url.searchParams.get('track'))
	);
	const tableData = $derived(
		trackData.data
			?.filter((track) => !selectedTrack || track.trackId === selectedTrack._id)
			.map((track) => ({
				trackId: track.trackId,
				trackImage: track.trackImg,
				trackName: track.trackName,
				count: track.counts,
				average: Number.isFinite(track.averageParticipants) ? track.averageParticipants : null,
				bestPlayerName: track.userAverages[0]?.userName ?? '—',
				bestAverage: track.userAverages[0]?.average ?? null,
				bestPlayerId: track.userAverages[0]?.userId ?? null,
				gap:
					track.userAverages.length > 1
						? track.userAverages[1].average! - track.userAverages[0].average!
						: null
			}))
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
		<p class="text-muted-foreground mt-3 max-w-2xl">
			Compare the tracks and see who leads on each course.
		</p>
		{#if tableData}
			<p class="text-muted-foreground mt-4 text-sm tabular-nums">
				{tableData.length}
				{tableData.length === 1 ? 'track' : 'tracks'} · {tableData
					.reduce((sum, track) => sum + track.count, 0)
					.toLocaleString()} races scheduled
			</p>
		{/if}
	</header>

	{#if trackData.error}
		<section class="py-12" role="alert">
			<h2 class="text-xl font-semibold">Could not load track stats</h2>
			<p class="text-muted-foreground mt-2">
				Check your connection and reload the page to try again.
			</p>
			<Button variant="outline" class="mt-4" onclick={() => window.location.reload()}
				>Reload page</Button
			>
		</section>
	{:else if !tableData}
		<p class="text-muted-foreground py-12" role="status">Loading track stats…</p>
	{:else}
		<section class="mt-6" aria-label="Track comparison">
			<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
				<p class="text-muted-foreground text-sm">
					{selectedTrack
						? `Showing ${selectedTrack.name}`
						: 'All-time stats · Select a track for results and race history.'}
				</p>
				{#if selectedTrack}
					<Button variant="outline" size="sm" href={resolve('/track-stats')}>Show all tracks</Button
					>
				{/if}
			</div>
			<DataTable {columns} data={tableData} />
			<div class="text-muted-foreground mt-5 grid gap-2 text-sm sm:grid-cols-2 sm:gap-8">
				<p>
					Races are counted by their end track, including transitions. Avg. racers counts recorded
					finishes per race.
				</p>
				<p>
					The leading player has the lowest average finishing position. Lead gap is the difference
					to the next player’s average.
				</p>
			</div>
		</section>
	{/if}
</main>
