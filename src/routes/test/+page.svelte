<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextchance } from 'layerchart';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';

	const data = $props();

	console.log(data);

	let context = $state<ChartContextchance>();

	let unformattedData = $state(data);

	let chartData = $derived(
		unformattedData.map((chance) => {
			return {
				user: chance.user.name,
				chance: Math.floor(chance.chance * 10) / 10
			};
		})
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Bar Chart - Label</Card.Title>
		<Card.Description>January - June 2024</Card.Description>
	</Card.Header>
	<Card.Content>
		<Chart.Container>
			<BarChart
				labels={{ offset: 12 }}
				data={chartData}
				xScale={scaleBand().padding(0.25)}
				x="user"
				series={[{ key: 'chance', label: 'Chance', color: '#f5cd30' }]}
				axis="x"
				rule={false}
				props={{
					bars: {
						stroke: 'none',
						radius: 8,
						rounded: 'all',
						// use the height of the chart to animate the bars
						initialY: (context?.height ?? 0) + 180,
						initialHeight: 0,
						motion: {
							y: { type: 'tween', duration: 500, easing: cubicInOut },
							height: { type: 'tween', duration: 500, easing: cubicInOut }
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
	<Card.Footer>
		<div class="flex w-full items-start gap-2 text-sm">
			<div class="grid gap-2">
				<div class="flex items-center gap-2 leading-none font-medium">
					Trending up by 5.2% this user <TrendingUpIcon class="size-4" />
				</div>
				<div class="text-muted-foreground flex items-center gap-2 leading-none">
					Showing total visitors for the last 6 users
				</div>
			</div>
		</div>
	</Card.Footer>
</Card.Root>
