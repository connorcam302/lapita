<script lang="ts">
	import { page } from '$app/state';
	import * as Select from '$lib/components/ui/select/index';
	import { convexStore } from '$lib/stores/states.svelte';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { calculatorStats, characterDataset, kartDataset } from '$lib/data/StatsDataset';
	import {
		getCharacterImage,
		getCharacterName,
		getKartImage,
		getKartName,
		getStatColour
	} from '$lib/utils';
	import { scaleBand } from 'd3-scale';
	import { BarChart } from 'layerchart';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Label } from '$lib/components/ui/label';

	let characterList = $derived(convexStore.allCharacters ?? []);
	let kartList = $derived(convexStore.allKarts ?? []);

	let selectedCharacterId = $derived(
		characterList?.find((character) => character._id === page.url.searchParams.get('character'))
			?._id ??
			characterList?.find(
				(character) => character._id === localStorage.getItem('selectedCharacterId')
			)?._id ??
			characterList?.[0]?._id
	);
	let selectedKartId = $derived(
		kartList?.find((kart) => kart._id === page.url.searchParams.get('kart'))?._id ??
			kartList?.find((kart) => kart._id === localStorage.getItem('selectedKartId'))?._id ??
			kartList?.[0]?._id
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

	const chartData = $derived(
		calculatorStats.map(({ key, label }) => ({
			stat: label,
			character: characterStats?.[key],
			kart: kartStats?.[key]
		}))
	);
	const chartMaximum = $derived(
		Math.max(12, ...chartData.flatMap(({ character, kart }) => [character ?? 0, kart ?? 0]))
	);
	const chartConfig = {
		character: { label: 'Character', color: 'var(--chart-2)' },
		kart: { label: 'Kart', color: 'var(--color-lapita)' }
	} satisfies Chart.ChartConfig;
	const statsAvailable = $derived(!!characterStats && !!kartStats);
	const average = (character: number | undefined, kart: number | undefined) =>
		character === undefined || kart === undefined ? undefined : (character + kart) / 2;
</script>

<svelte:head>
	<title>Calculator · Lapita</title>
	<meta
		name="description"
		content="Explore character and kart stats for your Lapita combination."
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="border-b pb-7">
		<h1 class="font-title text-2xl sm:text-3xl">Calculator</h1>
	</header>

	<div class="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
		<Card.Root class="min-w-0 rounded-md shadow-none">
			<Card.Header>
				<h2 class="font-title text-lg">Your combination</h2>
			</Card.Header>
			<Card.Content class="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
				<div class="min-w-0 space-y-3">
					<Label for="calculator-character">Character</Label>
					<Select.Root type="single" bind:value={selectedCharacterId}>
						<Select.Trigger
							id="calculator-character"
							class="w-full"
							aria-label="Character"
							disabled={!characterList?.length}
						>
							<span class="truncate">{characterName || 'Choose a character'}</span>
						</Select.Trigger>
						<Select.Content>
							{#each characterList ?? [] as { name, _id } (_id)}
								<Select.Item value={_id}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if characterImage}<img
							class="mx-auto h-28 w-full object-contain"
							src={`/characters/${characterImage}.png`}
							alt={characterName}
						/>{/if}
				</div>
				<div class="min-w-0 space-y-3">
					<Label for="calculator-kart">Kart</Label>
					<Select.Root type="single" bind:value={selectedKartId}>
						<Select.Trigger
							id="calculator-kart"
							class="w-full"
							aria-label="Kart"
							disabled={!kartList?.length}
						>
							<span class="truncate">{kartName || 'Choose a kart'}</span>
						</Select.Trigger>
						<Select.Content>
							{#each kartList ?? [] as { name, _id } (_id)}
								<Select.Item value={_id}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if kartImage}<img
							class="mx-auto h-28 w-full object-contain"
							src={`/karts/${kartImage}.png`}
							alt={kartName}
						/>{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="min-w-0 rounded-md shadow-none">
			<Card.Header>
				<h2 class="font-title text-lg">Combination stats</h2>
				<Card.Description id="average-description"
					>Each combined average is (character + kart) ÷ 2 for that stat, using Lapita’s stat scale.
					Each stat has its own zero-based scale. Stats shared by every character and kart are
					omitted.</Card.Description
				>
			</Card.Header>
			<Card.Content>
				{#if !statsAvailable}<p class="text-muted-foreground mb-4 text-sm" role="status">
						Some stats are unavailable for this selection. Choose another character or kart to see
						all combined values.
					</p>{/if}
				<Table.Root
					class="tabular-nums"
					aria-label="Character, kart and combined stats"
					aria-describedby="average-description"
				>
					<Table.Header
						><Table.Row>
							<Table.Head scope="col">Stat</Table.Head>
							<Table.Head scope="col" class="text-right">Character</Table.Head>
							<Table.Head scope="col" class="text-right">Kart</Table.Head>
							<Table.Head scope="col" class="bg-muted/50 text-foreground text-right"
								>Combined avg.</Table.Head
							>
						</Table.Row></Table.Header
					>
					<Table.Body>
						{#each chartData as { stat, character, kart } (stat)}
							{@const combined = average(character, kart)}
							<Table.Row>
								<th scope="row" class="h-10 px-2 text-left font-medium whitespace-nowrap">{stat}</th
								>
								<Table.Cell class="text-muted-foreground text-right">{character ?? '—'}</Table.Cell>
								<Table.Cell class="text-muted-foreground text-right">{kart ?? '—'}</Table.Cell>
								<Table.Cell class="bg-muted/50 text-right font-semibold">
									<span class="inline-flex items-center gap-2">
										{#if combined !== undefined}<span
												class="size-2 shrink-0 rounded-full"
												style:background-color={getStatColour(Math.round(combined))}
												aria-hidden="true"
											></span>{/if}
										{combined ?? '—'}
									</span>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root class="mt-6 min-w-0 rounded-md shadow-none">
		<Card.Header>
			<h2 class="font-title text-lg">Stat breakdown</h2>
			<Card.Description
				>Character and kart values side by side. Exact values and combined averages are in the table
				above.</Card.Description
			>
			<div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
				<span class="flex items-center gap-2"
					><span class="h-2.5 w-4 rounded-xs" style:background-color={chartConfig.character.color}
					></span>Character</span
				>
				<span class="flex items-center gap-2"
					><span class="bg-lapita h-2.5 w-4 rounded-xs"></span>Kart</span
				>
			</div>
		</Card.Header>
		<Card.Content>
			{#if statsAvailable}
				<Chart.Container
					config={chartConfig}
					class="aspect-auto w-full"
					style={`height: ${chartData.length * 46 + 36}px`}
					aria-label={`Character and kart values for all ${chartData.length} stats. Exact values are in the combination stats table.`}
				>
					<BarChart
						data={chartData}
						y="stat"
						orientation="horizontal"
						yScale={scaleBand().padding(0.3)}
						y1Scale={scaleBand().paddingInner(0.15)}
						xDomain={[0, chartMaximum]}
						padding={{ left: 112, right: 12, top: 8, bottom: 28 }}
						series={[
							{
								key: 'character',
								label: chartConfig.character.label,
								color: chartConfig.character.color
							},
							{ key: 'kart', label: chartConfig.kart.label, color: chartConfig.kart.color }
						]}
						seriesLayout="group"
						axis={true}
						rule={false}
						props={{ xAxis: { ticks: 6 }, bars: { stroke: 'none', radius: 3 } }}
					>
						{#snippet tooltip()}<Chart.Tooltip
								labelFormatter={(_, payload) => `${payload[0]?.payload?.stat ?? ''}`}
							/>{/snippet}
					</BarChart>
				</Chart.Container>
			{:else}<p class="text-muted-foreground py-10 text-sm">
					The chart appears when both selections have stats.
				</p>{/if}
		</Card.Content>
	</Card.Root>
</main>
