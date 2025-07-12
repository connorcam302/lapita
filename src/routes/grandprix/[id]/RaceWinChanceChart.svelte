<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextValue } from 'layerchart';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';

	const chartConfig = {
		desktop: { label: 'Desktop', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;

	let { chances } = $props();

	console.log(chances);

	const chartData = chances.data.map((chance) => {
		return {
			user: chance.user.name,
			chance: Math.floor(chance.chance * 10) / 10
		};
	});

	let context = $state<ChartContextValue>();
</script>

<Card.Root class='border-none'>
	<Card.Header>
		<Card.Title>Win Chance</Card.Title>
		<Card.Description>Percent Chance to Win {chances.trackName}</Card.Description>
	</Card.Header>
	<Card.Content>
		<Chart.Container class="h-32 w-full" config={chartConfig}>
			<BarChart
				bind:context
				data={chartData}
				xScale={scaleBand().padding(0.25)}
				x="user"
				axis="x"
				series={[{ key: 'chance', label: 'Win Chance', color: "#fdcf32" }]}
				props={{
					bars: {
						stroke: 'none',
						rounded: 'top',
						radius: 4,
						// use the height of the chart to animate the bars
						initialY: context?.height,
						initialHeight: 0,
						motion: {
							x: { type: 'tween', duration: 500, easing: cubicInOut },
							width: { type: 'tween', duration: 500, easing: cubicInOut },
							height: { type: 'tween', duration: 500, easing: cubicInOut },
							y: { type: 'tween', duration: 500, easing: cubicInOut }
						}
					},
					highlight: { area: { fill: 'none' } }
				}}
			>
				{#snippet tooltip()}
					<Chart.Tooltip hideLabel />
				{/snippet}
			</BarChart>
		</Chart.Container>
	</Card.Content>
</Card.Root>
