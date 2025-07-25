<script lang="ts">
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextchance } from 'layerchart';
	import * as Table from '$lib/components/ui/table/index.js';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';
	import { getPositionColour, getTrackName, getPlayerName } from '$lib/utils';
	import { allTracks, allUsers } from '$lib/stores/states.svelte';

	let { data } = $props();

	let playerList = $derived(allUsers);
	let trackList = $derived(allTracks);

	let context = $state<ChartContextchance>();

	let unformattedData = $derived(data);

	let trackId = $derived(data[0].user.trackId);

	let chartData = $derived(
		unformattedData.map((chance) => {
			return {
				user: getPlayerName(playerList, chance.user.userId),
				chance: Math.floor(chance.chance * 10) / 10,
				average: chance.user.average,
				formFactor: chance.formFactor,
				form: chance.user.recentForm,
				colour: getPositionColour(chance.user.average)
			};
		})
	);

	const chartConfig = {
		desktop: { label: 'Desktop', color: '#f5cd30' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="border-none px-0 py-0 shadow-none">
	<Card.Header class="px-0">
		<Card.Title>Win Chance</Card.Title>
		<Card.Description
			>Percent chance to win <b>{getTrackName(trackList, trackId)}</b></Card.Description
		>
	</Card.Header>
	<Card.Content class="px-6">
		<Chart.Container class="h-48 w-full" config={chartConfig}>
			<BarChart
				labels={{ format: (value) => `${value}%`, offset: 12 }}
				data={chartData}
				yScale={scaleBand().padding(0.25)}
				y="user"
				x="chance"
				orientation="horizontal"
				padding={{ left: 0, right: 0, top: 0, bottom: 0 }}
				axis="y"
				cRange={chartData.map((c) => c.colour)}
				c="colour"
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
							x: { type: 'tween', duration: 500, easing: cubicInOut },
							width: { type: 'tween', duration: 500, easing: cubicInOut }
						}
					},
					highlight: { area: { fill: 'none' } },
					yAxis: {
						tickLabelProps: {
							textAnchor: 'start',
							dx: 6,
							class: 'stroke-none fill-background!'
						},
						tickLength: 0
					}
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
										<Table.Cell class="text-right text-xs font-medium"
											>{item.payload.chance}%</Table.Cell
										>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Average Pos</Table.Cell>
										<Table.Cell class="text-right text-xs font-medium"
											>{item.payload.average.toFixed(2)}</Table.Cell
										>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Form Factor</Table.Cell>
										<Table.Cell class="text-right text-xs font-medium"
											>{item.payload.formFactor}</Table.Cell
										>
									</Table.Row>
									<Table.Row class="">
										<Table.Cell class="text-xs">Form</Table.Cell>
										<Table.Cell class="text-right text-xs font-medium"
											>{item.payload.form}</Table.Cell
										>
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
