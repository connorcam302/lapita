<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { SvelteURL } from 'svelte/reactivity';
	import { LineChart } from 'layerchart';
	import { curveLinear } from 'd3';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import Minus from '@lucide/svelte/icons/minus';
	import { getTrackImage, getTrackName } from '$lib/utils';
	import { useRecoverableQuery } from '$lib/use-recoverable-query.svelte';
	import {
		buildPersonalProgress,
		parseProgressPeriod,
		progressSizes
	} from '$lib/personal-progress';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';

	let { userId }: { userId: Id<'users'> } = $props();
	const period = $derived(parseProgressPeriod(page.url.searchParams));
	const query = useRecoverableQuery(api.results.personalProgress, () => ({ userId, ...period }));
	const progress = $derived(buildPersonalProgress(query.data?.gps ?? [], period.size));
	const delta = $derived(
		progress.recent.average !== null && progress.previous.average !== null
			? progress.recent.average - progress.previous.average
			: null
	);
	const config = {
		average: { label: 'Average finish', color: 'var(--primary)' }
	} satisfies Chart.ChartConfig;
	const format = (value: number | null) => (value === null ? '—' : value.toFixed(2));
	function change(value: number | null) {
		if (value === null) return 'No comparison yet';
		if (Math.abs(value) < 0.005) return 'Holding steady';
		return `${Math.abs(value).toFixed(2)} ${Math.abs(value) === 1 ? 'place' : 'places'} ${value < 0 ? 'better' : 'worse'}`;
	}
	function range(gps: { order: number }[]) {
		return gps.length ? `GP ${gps.at(-1)!.order}–${gps[0].order}` : 'No eligible GPs';
	}
	async function selectPeriod(event: SubmitEvent) {
		event.preventDefault();
		const form = new FormData(event.currentTarget as HTMLFormElement);
		const url = new SvelteURL(page.url);
		url.searchParams.set('progressSize', String(form.get('size')));
		const through = String(form.get('through') ?? '').trim();
		if (through) url.searchParams.set('progressThrough', through);
		else url.searchParams.delete('progressThrough');
		url.hash = 'personal-progress';
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- The path is resolved before appending query parameters and the hash.
		await goto(`${resolve('/players/[userId]', { userId })}${url.search}${url.hash}`, {
			keepFocus: true,
			noScroll: true
		});
	}

	const trackChanges = $derived(
		progress.tracks
			.filter((track) => track.delta !== null)
			.sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
			.slice(0, 3)
	);
	function tone(value: number | null) {
		return value === null || Math.abs(value) < 0.005
			? 'text-muted-foreground'
			: value < 0
				? 'text-emerald-700 dark:text-emerald-400'
				: 'text-rose-700 dark:text-rose-400';
	}
	function tint(value: number | null) {
		return value === null || Math.abs(value) < 0.005
			? 'bg-muted'
			: value < 0
				? 'bg-emerald-500/10'
				: 'bg-rose-500/10';
	}
</script>

<section
	id="personal-progress"
	aria-labelledby="progress-heading"
	class="bg-card min-w-0 overflow-hidden rounded-xl border"
>
	<header class="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
		<div>
			<h2 id="progress-heading" class="font-title text-lg">Personal progress</h2>
			<p class="text-muted-foreground mt-1 text-xs">
				Recent {progress.recent.gps.length} vs previous {progress.previous.gps.length} eligible GPs
			</p>
		</div>
		<details class="group max-w-full">
			<summary
				class="focus-visible:ring-ring decoration-primary cursor-pointer rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:ring-2"
				>Change period</summary
			>
			<div class="mt-3 max-w-full">
				<form onsubmit={selectPeriod} class="flex flex-wrap items-end gap-3">
					<label class="grid gap-2 text-sm" for="progress-size"
						>GPs per period
						<select
							id="progress-size"
							name="size"
							value={period.size}
							class="bg-background focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
						>
							{#each progressSizes as size (size)}<option value={size}
									>{size} {size === 1 ? 'GP' : 'GPs'}</option
								>{/each}
						</select>
					</label>
					<label class="grid gap-2 text-sm" for="progress-through"
						>Through GP (optional)
						<Input
							id="progress-through"
							name="through"
							type="number"
							min="1"
							step="1"
							value={period.through ?? ''}
							placeholder="Latest"
							class="bg-background focus-visible:ring-ring placeholder:text-muted-foreground h-9 w-40 rounded-md border px-3 focus-visible:ring-2"
						/>
					</label>
					<Button type="submit" variant="outline" size="sm">Apply period</Button>
				</form>
				<p class="text-muted-foreground mt-2 max-w-sm text-xs">
					Copy the page address to share your selected period.
				</p>
			</div>
		</details>
	</header>
	{#if query.error}
		<div role="alert" class="p-5">
			<p>Personal progress could not be loaded.</p>
			<Button class="mt-3" variant="outline" size="sm" onclick={() => query.retry()}
				>Retry progress</Button
			>
		</div>
	{:else if query.isLoading}
		<p role="status" class="text-muted-foreground p-5">Loading personal progress…</p>
	{:else if !progress.recent.count}
		<p class="text-muted-foreground p-5">
			No recorded finishes in this period. Choose a later GP or record a finish to start tracking
			progress.
		</p>
	{:else}
		<div class="grid min-w-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
			<div class="min-w-0 p-4 sm:p-5">
				<div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-4">
					<div>
						<h3 class="text-muted-foreground text-xs">Overall average finish</h3>
						<p
							class={`mt-1 flex items-center gap-2 text-sm font-semibold tabular-nums sm:text-lg ${tone(delta)}`}
						>
							<span
								class={`flex size-7 shrink-0 items-center justify-center rounded-md ${tint(delta)}`}
								aria-hidden="true"
							>
								{#if delta !== null && delta < -0.005}<TrendingDown
										class="size-4"
									/>{:else if delta !== null && delta > 0.005}<TrendingUp
										class="size-4"
									/>{:else}<Minus class="size-4" />{/if}
							</span>{change(delta)}
						</p>
						<p class="text-muted-foreground mt-1 text-xs tabular-nums">
							{format(progress.previous.average)} → {format(progress.recent.average)} · {progress
								.previous.count} / {progress.recent.count} finishes
						</p>
					</div>
					<div>
						<h3 class="text-muted-foreground text-xs">On the same tracks</h3>
						<p
							class={`mt-1 pt-0.5 text-sm font-semibold tabular-nums ${tone(progress.shared.delta)}`}
						>
							{change(progress.shared.delta)}
						</p>
						<p class="text-muted-foreground mt-2 text-xs">
							{progress.shared.count} shared tracks · equal weight per track
						</p>
					</div>
				</div>
				{#if !progress.previous.count}
					<p class="text-muted-foreground mt-3 text-xs">
						Choose a smaller period to compare a shorter history. Two eligible GPs are needed at
						minimum.
					</p>
				{:else if progress.previous.gps.length < period.size}
					<p class="text-muted-foreground mt-3 text-xs">
						Short history: {progress.previous.gps.length} of {period.size} previous GPs available.
					</p>
				{/if}
				{#if progress.trend.length > 1}<Chart.Container
						{config}
						class="mt-3 aspect-auto h-32 w-full sm:h-44"
						aria-label="Average finish by Grand Prix. Lower is better. Exact values and samples are available in All results and chart data."
					>
						<LineChart
							data={progress.trend}
							x="order"
							series={[
								{ key: 'average', label: config.average.label, color: config.average.color }
							]}
							yDomain={[1, 24]}
							yNice={false}
							rule={false}
							props={{
								spline: { curve: curveLinear, strokeWidth: 3 },
								xAxis: {
									ticks: Math.min(5, progress.trend.length),
									format: (v) => (Number.isInteger(v) ? `GP ${v}` : '')
								},
								yAxis: { ticks: [1, 6, 12, 18, 24] }
							}}
						>
							{#snippet tooltip()}<Chart.Tooltip
									labelFormatter={(_, payload) =>
										`GP ${payload[0]?.payload?.order} · ${payload[0]?.payload?.count} recorded finishes`}
								/>{/snippet}
						</LineChart>
					</Chart.Container>
				{:else}<p class="text-muted-foreground py-8 text-sm">
						A trend appears after a second GP.
					</p>{/if}
			</div>
			<div class="min-w-0 border-t p-4 sm:p-5 lg:border-t-0 lg:border-l">
				<h3 class="text-sm font-medium">
					Biggest track change<span class="hidden lg:inline">s</span>
				</h3>
				<ul class="mt-3 divide-y">
					{#each trackChanges as track, index (track.trackEndId)}
						<li class={`items-center gap-3 py-3 ${index === 0 ? 'flex' : 'hidden lg:flex'}`}>
							<img
								class="size-10 shrink-0 object-contain"
								src={`/tracks/icons/${getTrackImage(convexStore.allTracks ?? [], track.trackEndId as Id<'tracks'>)}.png`}
								alt=""
							/>
							<div class="min-w-0 flex-1">
								<a
									class="focus-visible:ring-ring block rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
									href={resolve('/tracks/[trackId]', { trackId: track.trackEndId })}
									>{getTrackName(convexStore.allTracks ?? [], track.trackEndId as Id<'tracks'>)}</a
								>
								<p class="text-muted-foreground mt-1 text-xs tabular-nums">
									{format(track.previous.average)} → {format(track.recent.average)} · {track
										.previous.count} / {track.recent.count} finishes
								</p>
								<p class={`mt-1 text-xs font-semibold ${tone(track.delta)}`}>
									{change(track.delta)}
								</p>
							</div>
						</li>
					{:else}<li class="text-muted-foreground py-6 text-sm">
							Track comparisons appear when a track has recorded finishes in both periods.
						</li>{/each}
				</ul>
			</div>
		</div>
		{#if query.data?.limited}<p role="status" class="text-muted-foreground px-5 pb-3 text-xs">
				Search limited to 500 GPs. Choose an earlier “Through GP” to explore older history.
			</p>{/if}
		<footer class="border-t px-4 py-3 sm:px-5">
			<details>
				<summary
					class="focus-visible:ring-ring w-fit cursor-pointer rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
					>All results and chart data</summary
				>
				<div class="mt-5 space-y-6">
					<div>
						<h3 class="text-sm font-medium">Overall · previous vs recent</h3>
						<Table.Root class="mt-4 tabular-nums">
							<Table.Caption
								>Overall results use every recorded finish in each period.</Table.Caption
							>
							<Table.Header
								><Table.Row
									><Table.Head>Measure</Table.Head><Table.Head class="text-right"
										>Previous</Table.Head
									><Table.Head class="text-right">Recent</Table.Head></Table.Row
								></Table.Header
							>
							<Table.Body>
								<Table.Row
									><Table.Cell>GP range</Table.Cell><Table.Cell class="text-right"
										>{range(progress.previous.gps)}</Table.Cell
									><Table.Cell class="text-right">{range(progress.recent.gps)}</Table.Cell
									></Table.Row
								>
								<Table.Row
									><Table.Cell>Eligible GPs</Table.Cell><Table.Cell class="text-right"
										>{progress.previous.gps.length}</Table.Cell
									><Table.Cell class="text-right">{progress.recent.gps.length}</Table.Cell
									></Table.Row
								>
								<Table.Row
									><Table.Cell>Recorded finishes</Table.Cell><Table.Cell class="text-right"
										>{progress.previous.count}</Table.Cell
									><Table.Cell class="text-right">{progress.recent.count}</Table.Cell></Table.Row
								>
								<Table.Row
									><Table.Cell>Average finish ↓</Table.Cell><Table.Cell class="text-right"
										>{format(progress.previous.average)}</Table.Cell
									><Table.Cell class="text-right">{format(progress.recent.average)}</Table.Cell
									></Table.Row
								>
								<Table.Row
									><Table.Cell>Race win rate</Table.Cell><Table.Cell class="text-right"
										>{progress.previous.winRate === null
											? '—'
											: `${(progress.previous.winRate * 100).toFixed(1)}%`} ({progress.previous
											.wins} wins)</Table.Cell
									><Table.Cell class="text-right"
										>{progress.recent.winRate === null
											? '—'
											: `${(progress.recent.winRate * 100).toFixed(1)}%`} ({progress.recent.wins} wins)</Table.Cell
									></Table.Row
								>
								<Table.Row
									><Table.Cell>Average points / race</Table.Cell><Table.Cell class="text-right"
										>{format(progress.previous.points)}</Table.Cell
									><Table.Cell class="text-right">{format(progress.recent.points)}</Table.Cell
									></Table.Row
								>
							</Table.Body>
						</Table.Root>
					</div>
					<div>
						<h3 class="text-sm font-medium">Finishing-position trend</h3>
						<Table.Root class="mt-3 tabular-nums">
							<Table.Caption>All plotted values and sample sizes.</Table.Caption>
							<Table.Header
								><Table.Row
									><Table.Head>GP</Table.Head><Table.Head>Created</Table.Head><Table.Head
										>Period</Table.Head
									><Table.Head class="text-right">Finishes</Table.Head><Table.Head
										class="text-right">Avg. finish</Table.Head
									></Table.Row
								></Table.Header
							>
							<Table.Body
								>{#each progress.trend as gp (gp.id)}<Table.Row
										><Table.Cell
											><a
												class="underline underline-offset-4"
												href={resolve('/grandprix/[id]', { id: gp.id })}>GP {gp.order}</a
											></Table.Cell
										><Table.Cell
											>{new Date(gp.createdAt).toLocaleDateString('en-GB', {
												timeZone: 'Europe/London'
											})}</Table.Cell
										><Table.Cell>{gp.period}</Table.Cell><Table.Cell class="text-right"
											>{gp.count}</Table.Cell
										><Table.Cell class="text-right">{format(gp.average)}</Table.Cell></Table.Row
									>{/each}</Table.Body
							>
						</Table.Root>
					</div>
					<div>
						<h3 class="text-sm font-medium">All track comparisons</h3>
						<Table.Root class="mt-4 tabular-nums">
							<Table.Caption
								>Track averages by end track, including transitions. Counts are recorded finishes.
								Tracks in just one period have no change.</Table.Caption
							>
							<Table.Header
								><Table.Row
									><Table.Head>Track</Table.Head><Table.Head class="text-right"
										>Previous avg. (n)</Table.Head
									><Table.Head class="text-right">Recent avg. (n)</Table.Head><Table.Head
										>Change</Table.Head
									></Table.Row
								></Table.Header
							>
							<Table.Body
								>{#each progress.tracks as track (track.trackEndId)}<Table.Row
										><Table.Cell
											><a
												class="underline underline-offset-4"
												href={resolve('/tracks/[trackId]', { trackId: track.trackEndId })}
												>{getTrackName(
													convexStore.allTracks ?? [],
													track.trackEndId as Id<'tracks'>
												)}</a
											></Table.Cell
										><Table.Cell class="text-right"
											>{format(track.previous.average)} ({track.previous.count})</Table.Cell
										><Table.Cell class="text-right"
											>{format(track.recent.average)} ({track.recent.count})</Table.Cell
										><Table.Cell>{change(track.delta)}</Table.Cell></Table.Row
									>{/each}</Table.Body
							>
						</Table.Root>
					</div>
					<p class="text-muted-foreground max-w-prose text-xs">
						Shared-track averages: {format(progress.shared.previous)} previous → {format(
							progress.shared.recent
						)} recent, using {progress.shared.previousCount} / {progress.shared.recentCount} recorded
						finishes across {progress.shared.count} tracks. Each shared track counts equally in both periods
						to reduce track-mix bias.
					</p>
					<p class="text-muted-foreground max-w-prose text-xs">
						An eligible GP is an undeleted GP where this player participated and recorded at least
						one integer finish from 1–24. Ongoing GPs count. Periods follow GP order and never
						overlap. Missing and invalid finishes are excluded. Actual first places divided by
						recorded finishes give race win rate; average points uses Lapita’s 24-place scoring over
						recorded finishes. Transitions count by end track. Dates show GP creation, and edits can
						change earlier comparisons.
					</p>
				</div>
			</details>
		</footer>
	{/if}
</section>
