<script lang="ts">
	import { characterDataset, kartDataset } from '$lib/data/StatsDataset';
	import { convexStore } from '$lib/stores/states.svelte';
	import {
		getCharacterImage,
		getCharacterName,
		getKartImage,
		getKartName,
		getStatColour
	} from '$lib/utils';
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextValue } from 'layerchart';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { cubicInOut } from 'svelte/easing';
	import * as Table from '$lib/components/ui/table/index.js';

	let { character, kart } = $props();

	let characterList = $derived(convexStore.allCharacters);
	let kartList = $derived(convexStore.allKarts);

	let characterName = $derived(getCharacterName(characterList, character as Id<'characters'>));
	let characterImage = $derived(getCharacterImage(characterList, character as Id<'characters'>));
	let characterStats = $derived(characterDataset.getByName(characterName));

	let kartName = $derived(getKartName(kartList, kart as Id<'karts'>));
	let kartImage = $derived(getKartImage(kartList, kart as Id<'karts'>));
	let kartStats = $derived(kartDataset.getByName(kartName));

	const chartData = $derived([
		{ stat: 'Road Speed', character: characterStats?.roadSpeed, kart: kartStats?.roadSpeed },
		{
			stat: 'Terrain Speed',
			character: characterStats?.terrainSpeed,
			kart: kartStats?.terrainSpeed
		},
		{ stat: 'Water Speed', character: characterStats?.waterSpeed, kart: kartStats?.waterSpeed },
		{
			stat: 'Acceleration',
			character: characterStats?.acceleration,
			kart: kartStats?.acceleration
		},
		{ stat: 'Weight', character: characterStats?.weight, kart: kartStats?.weight },
		{
			stat: 'Road Handling',
			character: characterStats?.roadHandling,
			kart: kartStats?.roadHandling
		},
		{
			stat: 'Terrain Handling',
			character: characterStats?.terrainHandling,
			kart: kartStats?.terrainHandling
		},
		{
			stat: 'Water Handling',
			character: characterStats?.waterHandling,
			kart: kartStats?.waterHandling
		}
	]);
	const chartConfig = {
		character: { label: 'character', color: 'var(--chart-2)' },
		kart: { label: 'kart', color: '#f5cd30' }
	} satisfies Chart.ChartConfig;
	let context = $state<ChartContextValue>();
</script>

<div class="flex items-center gap-2">
	<div class="flex items-center gap-2">
		<img class="h-6 w-6" src={`/characters/${characterImage}.png`} alt={characterName} />
		<span>{characterName}</span>
	</div>
	<div class="flex items-center gap-2">
		<img class="h-6 w-6" src={`/karts/${kartImage}.png`} alt={kartName} />
		<span>{kartName}</span>
	</div>
</div>
<div class="flex flex-wrap items-start justify-center gap-2">
	<Card.Root>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-40">Stat</Table.Head>
						<Table.Head class="w-20 text-center">Character</Table.Head>
						<Table.Head class="w-20 text-center">Kart</Table.Head>
						<Table.Head class="w-20 text-center">Average</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each chartData as { stat, character, kart }}
						<Table.Row>
							<Table.Cell>{stat}</Table.Cell>
							<Table.Cell
								class="text-center text-black"
								style="background-color: {getStatColour(character)};">{character}</Table.Cell
							>
							<Table.Cell
								class="text-center text-black"
								style="background-color: {getStatColour(kart)};">{kart}</Table.Cell
							>
							<Table.Cell
								class="text-center text-black"
								style="background-color: {getStatColour(Math.round((kart + character) / 2))};"
								>{(kart + character) / 2}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
	<div class="w-full max-w-5xl">
		<Card.Root>
			<Card.Header>
				<Card.Title>Bar Chart - Multiple</Card.Title>
				<Card.Description>January - June 2024</Card.Description>
			</Card.Header>
			<Card.Content class="max-w-5xl py-4">
				<Chart.Container config={chartConfig}>
					<BarChart
						bind:context
						data={chartData}
						xScale={scaleBand().padding(0.25)}
						x="stat"
						axis="x"
						series={[
							{ key: 'character', label: 'Character', color: chartConfig.character.color },
							{ key: 'kart', label: 'Kart', color: chartConfig.kart.color }
						]}
						x1Scale={scaleBand().paddingInner(0.2)}
						seriesLayout="group"
						rule={false}
						props={{
							bars: {
								stroke: 'none',
								strokeWidth: 0,
								rounded: 'all',
								// use the height of the chart to animate the bars
								initialY: context?.height,
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
							<Chart.Tooltip />
						{/snippet}
					</BarChart>
				</Chart.Container>
			</Card.Content>
		</Card.Root>
	</div>
</div>
