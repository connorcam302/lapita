<script lang="ts">
	import { LineChart } from 'layerchart';
	import { curveStepAfter } from 'd3-shape';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import type { summarizeRivalry } from '$lib/rivalry';
	import { chartColours } from '$lib/utils';
	let {
		data,
		aName,
		bName
	}: { data: ReturnType<typeof summarizeRivalry>; aName: string; bName: string } = $props();
	const series = $derived([
		{ key: 'a', label: aName, color: chartColours[0] },
		{ key: 'b', label: bName, color: chartColours[1] }
	]);
	const config = $derived(
		Object.fromEntries(
			series.map((s) => [s.key, { label: s.label, color: s.color }])
		) satisfies Chart.ChartConfig
	);
	const timeline = $derived([
		{ raceNumber: 0, a: 0, b: 0, gpOrder: null, raceOrder: -1 },
		...data.timeline
	]);
</script>

<section
	class="bg-card min-w-0 rounded-xl border p-4 sm:p-6"
	aria-labelledby="rivalry-chart-heading"
>
	<h2 id="rivalry-chart-heading" class="font-title text-lg">Cumulative rivalry</h2>
	<p class="text-muted-foreground mt-2 text-sm">
		Finishes ahead in shared-race order, oldest first. Ties leave both lines unchanged.
	</p>
	<ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Chart players">
		{#each series as player (player.key)}
			<li class="flex items-center gap-2">
				<span class="h-1 w-5 rounded-sm" style:background-color={player.color} aria-hidden="true"
				></span>{player.label}
			</li>
		{/each}
	</ul>
	<Chart.Container
		{config}
		class="mt-5 aspect-auto h-72 w-full sm:h-80"
		aria-label={`Cumulative finishes ahead: ${aName} ${data.aAhead}, ${bName} ${data.bAhead}`}
	>
		<LineChart
			data={timeline}
			x="raceNumber"
			{series}
			xDomain={[0, Math.max(1, data.count)]}
			xNice={false}
			yDomain={[0, Math.max(1, data.aAhead, data.bAhead)]}
			rule={false}
			props={{
				spline: { curve: curveStepAfter, strokeWidth: 2 },
				xAxis: {
					ticks: Math.min(6, data.count + 1),
					format: (v) => (Number.isInteger(v) ? `${v}` : '')
				},
				yAxis: { format: (v) => (Number.isInteger(v) ? `${v}` : '') }
			}}
		>
			{#snippet tooltip()}<Chart.Tooltip
					labelFormatter={(_, payload) => {
						const row = payload[0]?.payload;
						return row?.raceNumber
							? `GP ${row.gpOrder} · Race ${Number(row.raceOrder) + 1}`
							: 'Start of scope';
					}}
				/>{/snippet}
		</LineChart>
	</Chart.Container>
	<p class="text-muted-foreground mt-2 text-xs">
		Horizontal axis: shared races. Vertical axis: cumulative finishes ahead. Exact finishes are
		available in the results table below.
	</p>
</section>
