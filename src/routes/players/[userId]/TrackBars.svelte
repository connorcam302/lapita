<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextValue } from 'layerchart';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';
	import { convexStore } from '$lib/stores/states.svelte';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { getTrackName } from '$lib/utils';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	interface TrackData {
		trackEndId: Id<'tracks'>;
		positions: number[];
		average: number;
	}

	let allTracks = $derived(convexStore.allTracks);

	let { data }: { data: TrackData[] } = $props();

	let chartData = $derived(
		data.map((track) => {
			return {
				name: getTrackName(allTracks, track.trackEndId),
				allTimeAverage: track.average,

				last10Average: track.positions.slice(-10).reduce((acc, position) => acc + position, 0) / 10
			};
		})
	);

	let yMax = $derived(
		chartData.reduce((acc, track) => {
			return Math.max(acc, track.last10Average, track.allTimeAverage);
		}, 0) + 0.5
	);

	let yMin = $derived(
		chartData.reduce((acc, track) => {
			return Math.min(acc, track.last10Average, track.allTimeAverage);
		}, Infinity) - 0.5
	);

	const chartConfig = {
		last10Average: { label: 'Last 10 Average', color: '#00bc7d' },
		allTimeAverage: { label: 'All Time Average', color: '#f6cc30' }
	} satisfies Chart.ChartConfig;
	let context = $state<ChartContextValue>();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Track Averages</Card.Title>
		<Card.Description
			>All time average in <span class="font-medium text-[#00bc7d]">green</span> and average of last
			10 races in
			<span class="font-medium text-[#f6cc30]">yellow</span></Card.Description
		>
	</Card.Header>
	<Card.Content>
		<ScrollArea class="w-full rounded border pb-2" orientation="horizontal">
			<Chart.Container config={chartConfig} class="h-64 w-[1200px]">
				<BarChart
					bind:context
					data={chartData}
					xScale={scaleBand().padding(0.25)}
					x="name"
					axis="x"
					series={[
						{
							key: 'last10Average',
							label: 'Last 10 Average',
							color: chartConfig.last10Average.color
						},
						{
							key: 'allTimeAverage',
							label: 'All Time Average',
							color: chartConfig.allTimeAverage.color
						}
					]}
					x1Scale={scaleBand().paddingInner(0.2)}
					seriesLayout="group"
					rule={false}
					yDomain={[yMin, yMax]}
					props={{
						bars: {
							stroke: 'none',
							strokeWidth: 0,
							rounded: 'top',
							// use the height of the chart to animate the bars
							initialY: context?.height,
							initialHeight: 0,
							motion: {
								y: { type: 'tween', duration: 500, easing: cubicInOut },
								height: { type: 'tween', duration: 500, easing: cubicInOut }
							}
						},
						highlight: { area: { fill: 'none' } },
						xAxis: {
							format: (d) =>
								d
									.match(/(^|\s)\b(\w)/g)
									.map((m) => m.trim().charAt(0))
									.join('')
						}
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip />
					{/snippet}
				</BarChart>
			</Chart.Container>
		</ScrollArea>
	</Card.Content>
</Card.Root>
