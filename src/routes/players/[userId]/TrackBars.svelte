<script lang="ts">
	import { BarChart } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { convexStore } from '$lib/stores/states.svelte';
	import { getTrackName } from '$lib/utils';
	import type { TrackSummary } from './player-data';

	let { data }: { data: TrackSummary[] } = $props();
	const chartData = $derived(
		data.map((track) => ({
			name: getTrackName(convexStore.allTracks ?? [], track.trackEndId),
			average: track.average,
			recent: track.recentAverage,
			races: track.positions.length
		}))
	);
	const maximumAverage = $derived(
		Math.max(
			2,
			Math.ceil(Math.max(0, ...data.flatMap((track) => [track.average, track.recentAverage])) / 2) *
				2
		)
	);
	const trackInitials = (name: string) =>
		name
			.split(/\s+/)
			.map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
			.filter(Boolean)
			.map((word) => (/^[A-Z]{2,3}$/.test(word) ? word : word[0]))
			.join('')
			.toUpperCase();
	const config = {
		average: { label: 'All time', color: 'var(--foreground)' },
		recent: { label: 'Last 10', color: 'var(--color-lapita)' }
	} satisfies Chart.ChartConfig;
</script>

<section class="bg-card min-w-0 rounded-md border p-4 sm:p-6" aria-labelledby="tracks-heading">
	<h2 id="tracks-heading" class="font-title text-lg">Track averages</h2>
	<div class="text-muted-foreground my-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
		<span class="flex items-center gap-2"
			><span class="bg-foreground h-2 w-5 rounded-xs"></span>All time</span
		>
		<span class="flex items-center gap-2"
			><span class="bg-lapita h-2 w-5 rounded-xs"></span>Last 10</span
		>
	</div>
	{#if !data.length}
		<p class="text-muted-foreground py-10">
			Track averages appear after the first recorded finish.
		</p>
	{:else}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard focus enables arrow-key scrolling.) -->
		<div
			class="focus-visible:ring-ring overflow-x-auto rounded-sm focus-visible:ring-2"
			role="region"
			aria-label="Track averages chart, scroll horizontally"
			tabindex="0"
		>
			<Chart.Container
				{config}
				class="aspect-auto h-[300px]"
				style={`width: ${Math.max(360, data.length * 48 + 60)}px`}
				aria-label="All-time and last-10 average finishes by track. Values are also available in the table below."
			>
				<BarChart
					data={chartData}
					x="name"
					orientation="vertical"
					padding={{ left: 36, right: 16, top: 12, bottom: 36 }}
					yDomain={[0, maximumAverage]}
					xScale={scaleBand().padding(0.35)}
					x1Scale={scaleBand().paddingInner(0.15)}
					series={[
						{ key: 'average', label: config.average.label, color: config.average.color },
						{ key: 'recent', label: config.recent.label, color: config.recent.color }
					]}
					seriesLayout="group"
					axis={true}
					rule={false}
					props={{
						xAxis: { format: (value) => trackInitials(String(value)) },
						yAxis: { ticks: 6 },
						bars: { stroke: 'none', radius: 3 }
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip
							labelFormatter={(_, payload) =>
								`${payload[0]?.payload?.name} · ${payload[0]?.payload?.races} races`}
						>
							{#snippet formatter({ value, name })}<span class="text-muted-foreground">{name}</span
								><span class="ml-auto font-medium tabular-nums">{Number(value).toFixed(2)}</span
								>{/snippet}
						</Chart.Tooltip>
					{/snippet}
				</BarChart>
			</Chart.Container>
		</div>
	{/if}
</section>
