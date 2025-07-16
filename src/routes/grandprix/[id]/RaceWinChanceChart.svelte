<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextchance } from 'layerchart';
	import * as Table from '$lib/components/ui/table/index.js';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';

	let { data } = $props();

	let context = $state<ChartContextchance>();

	let unformattedData = $state(data.data);

	let chartData = $derived(
		unformattedData.map((chance) => {
			return {
				user: chance.user.name,
				chance: Math.floor(chance.chance * 10) / 10,
				average: chance.user.average,
				formFactor: chance.formFactor,
				form: chance.user.recentForm
			};
		})
	);

	const chartConfig = {
		desktop: { label: 'Desktop', color: '#f5cd30' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="border-none">
	<Card.Header>
		<Card.Title>Win Chance</Card.Title>
		<Card.Description>Percent chance to win <b>{data.trackName}</b></Card.Description>
	</Card.Header>
	<Card.Content class="py-4">
		<Chart.Container class="h-48 w-full" config={chartConfig}>
			<BarChart
				labels={{ format: (value) => `${value}%`, offset: 12}}
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
						rounded: 'top',
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
					<Chart.Tooltip hideLabel class="w-[180px]">
						{#snippet formatter({ name, index, value, item })}
							<Table.Root class="table-fixed"
								><Table.Caption
									>{item.payload.user}
									<div class="text-[6pt]">
										Form Factor will always be 1 and Form will always be null
									</div></Table.Caption
								>
								<Table.Body>
									<Table.Row class="">
										<Table.Cell class="text-xs">Win Chance</Table.Cell>
										<Table.Cell class="text-right text-xs">{item.payload.chance}%</Table.Cell>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Average Pos</Table.Cell>
										<Table.Cell class="text-right text-xs"
											>{item.payload.average.toFixed(2)}</Table.Cell
										>
									</Table.Row>
									<Table.Row class="">
										<div></div>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Form Factor</Table.Cell>
										<Table.Cell class="text-right text-xs">{item.payload.formFactor}</Table.Cell>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Form</Table.Cell>
										<Table.Cell class="text-right text-xs">{item.payload.form}</Table.Cell>
									</Table.Row>
								</Table.Body>
							</Table.Root>
						{/snippet}
					</Chart.Tooltip>
				{/snippet}
			</BarChart>
		</Chart.Container>
	</Card.Content>
</Card.Root>
