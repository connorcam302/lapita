<script lang="ts">
	import CharacterKartStats from '$lib/components/custom/CharacterKartStats.svelte';
	import * as Select from '$lib/components/ui/select/index';
	import { convexStore } from '$lib/stores/states.svelte';
	import type { Id } from '../../convex/_generated/dataModel';
	import { characterDataset, kartDataset } from '$lib/data/StatsDataset';
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
	import { Content } from '$lib/components/ui/dialog';
	import Separator from '$lib/components/ui/separator/separator.svelte';

	let characterList = $derived(convexStore.allCharacters);
	let kartList = $derived(convexStore.allKarts);

	let selectedCharacterId = $derived(
		characterList &&
			((localStorage.getItem('selectedCharacterId') ?? characterList[0]._id) as Id<'characters'>)
	);
	let selectedCharacter = $derived(
		characterList?.find((char) => char._id === (selectedCharacterId as Id<'characters'>))
	);
	let selectedKartId = $derived(
		kartList && ((localStorage.getItem('selectedKartId') ?? kartList[0]._id) as Id<'karts'>)
	);
	let selectedKart = $derived(
		kartList?.find((kart) => kart._id === (selectedKartId as Id<'karts'>))
	);

	let characterName = $derived(
		getCharacterName(characterList, selectedCharacterId as Id<'characters'>)
	);
	let characterImage = $derived(
		getCharacterImage(characterList, selectedCharacterId as Id<'characters'>)
	);
	let characterStats = $derived(characterDataset.getByName(characterName));

	let kartName = $derived(getKartName(kartList, selectedKartId as Id<'karts'>));
	let kartImage = $derived(getKartImage(kartList, selectedKartId as Id<'karts'>));
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

<div class="flex flex-col items-center justify-center gap-2 py-4">
	<div class="flex flex-wrap gap-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Combo Select</Card.Title>
				<Card.Description>Character and Kart combination selection</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex w-72 flex-col gap-2">
					<div>
						<Select.Root type="single" bind:value={selectedCharacterId}>
							<Select.Label>Character</Select.Label>
							<Select.Trigger class="w-[280px]">
								{selectedCharacterId && getCharacterName(characterList, selectedCharacterId)}
							</Select.Trigger>
							<Select.Content>
								{#each characterList as { name, _id } (_id)}
									<Select.Item value={_id}>{name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<img
							class="mx-auto h-24"
							src={`/characters/${characterImage}.png`}
							alt={characterName}
						/>
					</div>
					<Separator />
					<div>
						<Select.Root type="single" bind:value={selectedKartId}>
							<Select.Label>Kart</Select.Label>
							<Select.Trigger class="w-[280px]">
								{selectedKart && getKartName(kartList, selectedKartId)}
							</Select.Trigger>
							<Select.Content>
								{#each kartList as { name, _id } (_id)}
									<Select.Item value={_id}>{name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<img class="mx-auto h-24" src={`/karts/${kartImage}.png`} alt={kartName} />
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Stats Table</Card.Title>
				<Card.Description>Character and Kart stats with average</Card.Description>
			</Card.Header>
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
	</div>
	<div class="w-full max-w-5xl">
		<Card.Root>
			<Card.Header>
				<Card.Title>Combined Stats</Card.Title>
				<Card.Description
					>Character stats in <span class="font-medium text-[#00bc7d]">green</span> and kart stats
					in <span class="font-medium text-[#f6cc30]">yellow</span></Card.Description
				>
			</Card.Header>
			<Card.Content class=" max-w-5xl py-4">
				<Chart.Container config={chartConfig} class="h-64 w-full">
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
								rounded: 'top',
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
