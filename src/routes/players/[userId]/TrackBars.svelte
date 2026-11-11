<script lang="ts">
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import { getTrackName, getTrackImage } from '$lib/utils';
	import type { TrackSummary } from './player-data';
	let { data }: { data: TrackSummary[] } = $props();
	let order = $state('average');
	const tracks = $derived(convexStore.allTracks ?? []);
	const sorted = $derived(
		[...data].sort((a, b) =>
			order === 'recent'
				? a.recentAverage - b.recentAverage
				: order === 'races'
					? b.positions.length - a.positions.length
					: a.average - b.average
		)
	);
</script>

<section aria-labelledby="tracks-heading">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 id="tracks-heading" class="font-title text-lg">Track averages</h2>
			<p class="text-muted-foreground mt-2 text-sm">
				Lower is better. Tracks are grouped by the finish track.
			</p>
		</div>
		<label class="flex items-center gap-2 text-sm"
			>Sort by
			<select
				bind:value={order}
				class="bg-background border-input focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
			>
				<option value="average">All-time average</option>
				<option value="recent">Last 10 average</option>
				<option value="races">Most raced</option>
			</select>
		</label>
	</div>
	<div class="text-muted-foreground mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
		<span class="flex items-center gap-2"
			><span class="bg-foreground h-2 w-5 rounded-xs"></span>All time</span
		>
		<span class="flex items-center gap-2"
			><span class="bg-lapita h-2 w-5 rounded-xs"></span>Last 10, or available races</span
		>
	</div>
	{#if !data.length}
		<p class="text-muted-foreground py-10">
			Track averages appear after the first recorded finish.
		</p>
	{:else}
		<div class="grid gap-x-10 md:grid-cols-2">
			{#each sorted as track (track.trackEndId)}
				<a
					href={resolve(`/track-stats?track=${track.trackEndId}`)}
					class="hover:bg-muted focus-visible:ring-ring grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-sm border-b py-4 focus-visible:ring-2"
				>
					<img
						src={`/tracks/icons/${getTrackImage(tracks, track.trackEndId)}.png`}
						alt=""
						loading="lazy"
						class="size-10 object-contain"
					/>
					<div class="min-w-0">
						<div class="mb-2 flex items-baseline justify-between gap-2">
							<span class="text-sm font-medium">{getTrackName(tracks, track.trackEndId)}</span>
							<span class="text-muted-foreground shrink-0 text-xs"
								>{track.positions.length} races</span
							>
						</div>
						<div
							class="grid grid-cols-[1fr_2.5rem] items-center gap-x-3 gap-y-1 text-xs tabular-nums"
						>
							<div class="bg-muted h-2 rounded-xs">
								<div
									class="bg-foreground h-full rounded-xs"
									style:width={`${(track.average / 24) * 100}%`}
								></div>
							</div>
							<span class="text-right"
								><span class="sr-only">All time: </span>{track.average.toFixed(2)}</span
							>
							<div class="bg-muted h-2 rounded-xs">
								<div
									class="bg-lapita h-full rounded-xs"
									style:width={`${(track.recentAverage / 24) * 100}%`}
								></div>
							</div>
							<span class="text-right"
								><span class="sr-only">Recent: </span>{track.recentAverage.toFixed(2)}</span
							>
						</div>
					</div>
				</a>
			{/each}
		</div>
		<p class="text-muted-foreground mt-5 text-xs">
			Bars use the same 1–24 finishing-position scale. Select a track to explore its stats.
		</p>
	{/if}
</section>
