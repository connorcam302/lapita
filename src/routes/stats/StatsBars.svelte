<script lang="ts">
	import { BarChart } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import * as Chart from '$lib/components/ui/chart/index.js';
	let {
		data,
		label,
		percent = false
	}: { data: { name: string; value: number }[]; label: string; percent?: boolean } = $props();
	const config = $derived({
		value: { label, color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig);
</script>

{#if data.length}
	<Chart.Container
		{config}
		class="mt-4 aspect-auto w-full"
		style={`height: ${Math.max(200, data.length * 38)}px`}
		aria-label={label}
	>
		<BarChart
			{data}
			x="value"
			y="name"
			orientation="horizontal"
			yScale={scaleBand().padding(0.25)}
			padding={{
				left: Math.min(175, Math.max(...data.map((entry) => entry.name.length)) * 6.5 + 10),
				right: 16,
				top: 8,
				bottom: 28
			}}
			series={[{ key: 'value', label, color: 'var(--chart-1)' }]}
			axis={true}
			rule={false}
			props={{
				xAxis: { format: (value) => (percent ? `${value}%` : `${value}`) },
				bars: { stroke: 'none', radius: 3 }
			}}
		>
			{#snippet tooltip()}<Chart.Tooltip
					labelFormatter={(_, payload) => `${payload[0]?.payload?.name ?? ''}`}
				/>{/snippet}
		</BarChart>
	</Chart.Container>
	<details class="mt-3 text-sm">
		<summary
			class="text-muted-foreground focus-visible:outline-ring w-fit cursor-pointer rounded-sm focus-visible:outline-2"
			>View chart data</summary
		>
		<dl class="mt-3 space-y-2">
			{#each data as entry (entry.name)}<div class="flex justify-between gap-4">
					<dt>{entry.name}</dt>
					<dd class="tabular-nums">
						{entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}{percent
							? '%'
							: ''}
					</dd>
				</div>{/each}
		</dl>
	</details>
{:else}
	<p class="text-muted-foreground py-10 text-sm">No qualifying results yet.</p>
{/if}
