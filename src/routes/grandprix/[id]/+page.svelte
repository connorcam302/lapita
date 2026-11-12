<script lang="ts">
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import ManageGP from './ManageGP.svelte';
	import { buildRecap } from '$lib/gp-recap';
	import QueryNotice from '$lib/components/custom/QueryNotice.svelte';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { selectGpRace } from './race-selection';
	import { prefersReducedMotion } from 'svelte/motion';
	import { isValidFinishPosition } from '$lib/grand-prix';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import { calculatePointsComparison } from './expected-points';
	import { calculateGpOutlook, calculateStartingGpOutlook } from './gp-outlook';
	import { calculateCumulativePoints } from './cumulative-points';
	import type { PageData } from './$types';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import RouteIcon from '@lucide/svelte/icons/route';
	import MoveRightIcon from '@lucide/svelte/icons/move-right';
	import MoveUpRightIcon from '@lucide/svelte/icons/trending-up';
	import MoveDownRightIcon from '@lucide/svelte/icons/trending-down';
	import { onMount, onDestroy, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		cn,
		addNumberSuffix,
		getPositionColour,
		calculateConsistency,
		getConsistencyColorGradient,
		getCharacterName,
		getTrackName,
		getKartName,
		getPlayerName,
		getKartImage,
		getCharacterImage,
		chartColours
	} from '$lib/utils';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import MoveRight from '@lucide/svelte/icons/move-right';
	import EditTrackButton from '$lib/components/custom/EditTrackButton.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import RaceWinChanceChart from './RaceWinChanceChart.svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import MoveDownRight from '@lucide/svelte/icons/move-down-right';
	import MoveUpRight from '@lucide/svelte/icons/move-up-right';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { convexStore } from '$lib/stores/states.svelte';
	import { fade } from 'svelte/transition';
	import { cubicIn, cubicInOut } from 'svelte/easing';
	import type { FunctionReturnType } from 'convex/server';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { BarChart, type ChartState } from 'layerchart';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { characterDataset, kartDataset } from '$lib/data/StatsDataset';

	const { data }: { data: PageData } = $props();
	const client = useConvexClient();

	let tab = $state('results');

	const liveGp = useQuery(api.gps.getOne, () => ({ id: data.grandPrixDetails._id }));
	let grandPrixDetails = $derived({
		...(liveGp.data ?? data.grandPrixDetails),
		participants: [...(liveGp.data ?? data.grandPrixDetails).participants].sort((a, b) =>
			b.localeCompare(a)
		)
	});

	let kartList = $derived(convexStore.allKarts ?? []);
	let characterList = $derived(convexStore.allCharacters ?? []);
	let playerList = $derived(convexStore.allUsers ?? []);
	let trackList = $derived(convexStore.allTracks ?? []);

	const raceList = useQuery(api.races.inGrandPrix, () => ({ grandPrixId: grandPrixDetails._id }));
	const standings = useQuery(api.standings.getOne, () => ({ grandPrixId: grandPrixDetails._id }));

	let selectedCharacterId = $derived(
		characterList &&
			((characterList.find(
				(character) => character._id === localStorage.getItem('selectedCharacterId')
			)?._id ?? characterList[0]?._id) as Id<'characters'>)
	);
	let selectedCharacter = $derived(
		characterList?.find((char) => char._id === (selectedCharacterId as Id<'characters'>))
	);
	let selectedKartId = $derived(
		kartList &&
			((kartList.find((kart) => kart._id === localStorage.getItem('selectedKartId'))?._id ??
				kartList[0]?._id) as Id<'karts'>)
	);
	let selectedKart = $derived(
		kartList?.find((kart) => kart._id === (selectedKartId as Id<'karts'>))
	);
	let selectedUserId = $derived(
		playerList &&
			((grandPrixDetails.participants.find((id) => id === localStorage.getItem('selectedUserId')) ??
				grandPrixDetails.participants[0]) as Id<'users'>)
	);
	let selectedUser = $derived(
		playerList?.find((racer) => racer._id === (selectedUserId as Id<'users'>))
	);
	let selectedRaceId = $derived(
		selectGpRace(raceList.data ?? [], page.url.searchParams.get('track'))?._id
	);
	const selectedRace = $derived(raceList.data?.find((race) => race._id === selectedRaceId));
	const stats = useQuery(api.results.stats, () =>
		raceList.data
			? {
					tracks: raceList.data.map((race) => race.trackEndId),
					users: grandPrixDetails.participants
				}
			: 'skip'
	);
	const startingStats = useQuery(api.results.stats, () =>
		raceList.data
			? {
					tracks: raceList.data.map((race) => race.trackEndId),
					users: grandPrixDetails.participants,
					beforeGrandPrixId: grandPrixDetails._id
				}
			: 'skip'
	);
	const selectedRaceStats = $derived(
		stats.data?.find((stat) => stat.trackId === selectedRace?.trackEndId)
	);

	let finishPosition = $state('');
	let isSavingResult = $state(false);

	const resultsTable = useQuery(api.results.get, () => ({ grandPrixId: grandPrixDetails._id }));

	const cumulativeRows = $derived(
		calculateCumulativePoints(
			grandPrixDetails.participants,
			resultsTable && resultsTable.data ? resultsTable.data : []
		)
	);

	const gpOutlook = $derived(
		resultsTable && resultsTable.data && stats && stats.data
			? calculateGpOutlook(
					grandPrixDetails.participants,
					resultsTable.data,
					stats.data,
					grandPrixDetails.completedAt !== undefined
				)
			: undefined
	);

	const startingOutlook = $derived(
		resultsTable && resultsTable.data && startingStats && startingStats.data
			? calculateStartingGpOutlook(
					grandPrixDetails.participants,
					resultsTable.data,
					startingStats.data
				)
			: undefined
	);
	const outlookColumns = [
		{ key: 'name', label: 'Racer', group: '' },
		{ key: 'startingProjected', label: 'xPoints', group: 'Starting stats' },
		{ key: 'startingWinChance', label: 'Win GP %', group: 'Starting stats' },
		{ key: 'points', label: 'Points', group: 'Ongoing stats' },
		{ key: 'projected', label: 'xPoints', group: 'Ongoing stats' },
		{ key: 'maximum', label: 'Max points', group: 'Ongoing stats' },
		{ key: 'winChance', label: 'Win GP %', group: 'Ongoing stats' }
	] as const;
	type OutlookSortKey = (typeof outlookColumns)[number]['key'];
	let outlookSort = $state<{ key: OutlookSortKey; direction: 'asc' | 'desc' }>({
		key: 'points',
		direction: 'desc'
	});
	const sortOutlook = (key: OutlookSortKey) => {
		outlookSort = {
			key,
			direction:
				outlookSort.key === key
					? outlookSort.direction === 'asc'
						? 'desc'
						: 'asc'
					: key === 'name'
						? 'asc'
						: 'desc'
		};
	};
	const sortedOutlook = $derived.by(() => {
		const startingPlayers = new Map(
			startingOutlook?.players.map((player) => [player.userId, player])
		);
		return (gpOutlook?.players ?? [])
			.map((player) => ({
				...player,
				name: getPlayerName(playerList ?? [], player.userId),
				startingProjected: startingPlayers.get(player.userId)?.projected ?? null,
				startingWinChance: startingPlayers.get(player.userId)?.winChance ?? null
			}))
			.sort((a, b) => {
				const first = a[outlookSort.key];
				const second = b[outlookSort.key];
				if (first == null && second != null) return 1;
				if (second == null && first != null) return -1;
				const difference =
					typeof first === 'string' && typeof second === 'string'
						? first.localeCompare(second)
						: Number(first) - Number(second);
				return (
					(outlookSort.direction === 'asc' ? difference : -difference) ||
					a.name.localeCompare(b.name)
				);
			});
	});

	const pointsComparison = $derived(
		resultsTable && resultsTable.data && stats && stats.data
			? calculatePointsComparison(grandPrixDetails.participants, resultsTable.data, stats.data)
			: undefined
	);

	const raceComparisons = $derived(
		resultsTable && resultsTable.data && stats && stats.data
			? [...resultsTable.data]
					.sort((a, b) => a.order - b.order)
					.map((race) => ({
						race,
						comparisons: calculatePointsComparison(
							grandPrixDetails.participants,
							[race],
							stats.data!
						)
					}))
			: []
	);

	const comparisonColourScale = scaleLinear<string>()
		.domain([-5, -3, 0, 3, 5])
		.range(['#991b1b', '#f87171', '#ffcc00', '#00a63e', '#166534'])
		.clamp(true);
	const comparisonColour = (difference: number | null) =>
		difference == null || !Number.isFinite(difference)
			? 'transparent'
			: comparisonColourScale(difference);

	const mostUsed = <T extends string>(ids: (T | undefined)[]): T | undefined => {
		const counts = new Map<T, number>();
		for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
		return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
	};
	const playerMostUsedCharacterKart = $derived(
		grandPrixDetails.participants.map((userId) => {
			const results = (resultsTable.data ?? [])
				.flatMap((race) => race.results)
				.filter((result) => result.userId === userId && result.kartId && result.characterId);
			return {
				userId,
				kart: mostUsed(results.map((result) => result.kartId)),
				character: mostUsed(results.map((result) => result.characterId))
			};
		})
	);

	$effect(() => {
		if (!selectedRaceId || page.url.searchParams.get('track') === selectedRaceId) return;
		const url = new URL(page.url);
		url.searchParams.set('track', selectedRaceId);
		void goto(url, { noScroll: true, replaceState: true, keepFocus: true });
	});

	$effect(() => {
		selectedCharacterId && localStorage.setItem('selectedCharacterId', selectedCharacterId);
	});
	$effect(() => {
		selectedKartId && localStorage.setItem('selectedKartId', selectedKartId);
	});
	$effect(() => {
		selectedUserId && localStorage.setItem('selectedUserId', selectedUserId);
	});

	const submitRaceResults = async () => {
		if (isSavingResult || liveGp.error || liveGp.isLoading || !liveGp.data) return;
		const position = Number(finishPosition);
		if (!isValidFinishPosition(position)) {
			return toast.error('Invalid finish position', {
				description: 'Enter a whole number from 1 to 24.'
			});
		}
		if (
			!grandPrixDetails._id ||
			!selectedRace ||
			!selectedUser ||
			!grandPrixDetails.participants.includes(selectedUser._id) ||
			!selectedKart ||
			!selectedCharacter
		) {
			return toast.error('Missing selection', {
				description: 'Select a racer, race, character and kart before saving.'
			});
		}
		const submittedRaceId = selectedRace._id;
		const submittedRaces = raceList.data ?? [];
		isSavingResult = true;
		try {
			const res = await client.mutation(api.results.update, {
				grandPrixId: grandPrixDetails._id,
				raceId: submittedRaceId,
				position,
				userId: selectedUser._id,
				kartId: selectedKart._id,
				characterId: selectedCharacter._id
			});
			if (res?.status !== 'Ok') throw new Error('Result was not saved.');
			if (selectedRaceId === submittedRaceId) {
				const currentRaceIndex = submittedRaces.findIndex((race) => race._id === submittedRaceId);
				const nextRace = submittedRaces[currentRaceIndex + 1];
				if (nextRace) selectedRaceId = nextRace._id;
				finishPosition = '';
			}
			toast.success('Result saved');
		} catch {
			toast.error('Could not save result', {
				description: 'Try again. Your selections have been kept.'
			});
		} finally {
			isSavingResult = false;
		}
	};

	const statNames = [
		'roadSpeed',
		'terrainSpeed',
		'waterSpeed',
		'acceleration',
		'weight',
		'roadHandling',
		'terrainHandling',
		'waterHandling'
	] as const;

	const statLabels = {
		roadSpeed: 'Road Speed',
		terrainSpeed: 'Terrain Speed',
		waterSpeed: 'Water Speed',
		acceleration: 'Acceleration',
		weight: 'Weight',
		roadHandling: 'Road Handling',
		terrainHandling: 'Terrain Handling',
		waterHandling: 'Water Handling'
	};

	const chartData = $derived.by(() => {
		const combinations = playerMostUsedCharacterKart.map((player) => ({
			name: getPlayerName(playerList, player.userId),
			character: player.character
				? characterDataset.getByName(getCharacterName(characterList, player.character))
				: undefined,
			kart: player.kart ? kartDataset.getByName(getKartName(kartList, player.kart)) : undefined
		}));
		if (!combinations.length || combinations.some((combo) => !combo.character || !combo.kart))
			return undefined;
		return statNames.map((key) => {
			const point: Record<string, string | number> = { stat: statLabels[key] };
			for (const combo of combinations)
				point[combo.name] = combo.character![key] + combo.kart![key];
			return point;
		});
	});

	const chartConfig = $derived(
		grandPrixDetails &&
			(grandPrixDetails.participants.reduce((acc, userId) => {
				acc[getPlayerName(playerList, userId)] = {
					label: getPlayerName(playerList, userId),
					color: '#f5cd30' // or however you generate random colors
				};
				return acc;
			}, {} as Chart.ChartConfig) satisfies Chart.ChartConfig)
	);
	let context = $state<ChartState>();

	const chartKeys = $derived(
		grandPrixDetails &&
			grandPrixDetails.participants.map((userId, i) => {
				return {
					key: getPlayerName(playerList, userId),
					label: getPlayerName(playerList, userId),
					color: chartColours[i]
				};
			})
	);
</script>

{#snippet comparisonCell(comparison: { difference: number | null; recordedRaces: number })}
	{@const { difference, recordedRaces } = comparison}
	<span
		class="inline-block min-w-14 font-medium tabular-nums"
		aria-label={difference == null
			? recordedRaces
				? 'Expected points unavailable'
				: 'Not recorded'
			: difference === 0
				? 'On expected points'
				: `${Number(Math.abs(difference).toFixed(1))} points ${difference > 0 ? 'above' : 'below'} expected`}
	>
		{difference == null ? '—' : `${difference > 0 ? '+' : ''}${Number(difference.toFixed(1))}`}
	</span>
{/snippet}

<div>
	{#if !liveGp.isLoading && !liveGp.error && liveGp.data === null}
		<div class="mx-auto max-w-4xl space-y-4 px-4 py-8">
			<p role="status">This Grand Prix is no longer available.</p>
			<Button variant="outline" href="/grandprix">All Grand Prix</Button>
		</div>
	{:else if raceList.error && !raceList.data}
		<div class="mx-auto max-w-4xl px-4 py-8">
			<QueryNotice error label="Grand Prix races" retry={raceList.retry} />
		</div>
	{:else if !raceList.data}
		<div class="mx-auto max-w-4xl px-4 py-8"><QueryNotice loading label="Grand Prix races" /></div>
	{:else if !selectedRace}
		<div class="mx-auto max-w-4xl space-y-4 px-4 py-8">
			<ManageGP grandPrix={grandPrixDetails} players={playerList ?? []} />
			{#if resultsTable && resultsTable.data && buildRecap(grandPrixDetails.participants, resultsTable.data, grandPrixDetails.completedAt).complete}
				<div class="flex justify-end py-2">
					<Button
						variant="secondary"
						href={resolve('/grandprix/[id]/recap', { id: grandPrixDetails._id })}
						>View Grand Prix recap</Button
					>
				</div>
			{/if}
			<QueryNotice label="races" empty="No races are scheduled for this Grand Prix." />
			<Button variant="outline" href="/grandprix">All Grand Prix</Button>
		</div>
	{:else}
		<div class="mx-auto flex max-w-4xl flex-col gap-2 px-2 py-8">
			<ManageGP grandPrix={grandPrixDetails} players={playerList ?? []} />
			{#if resultsTable && resultsTable.data && buildRecap(grandPrixDetails.participants, resultsTable.data, grandPrixDetails.completedAt).complete}
				<div class="flex justify-end py-2">
					<Button
						variant="secondary"
						href={resolve('/grandprix/[id]/recap', { id: grandPrixDetails._id })}
						>View Grand Prix recap</Button
					>
				</div>
			{/if}
			{#if liveGp.error}<QueryNotice error label="Grand Prix updates" retry={liveGp.retry} />{/if}
			{#if raceList.error}<QueryNotice error label="race updates" retry={raceList.retry} />{/if}
			<Card.Root>
				<Card.Header>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex w-full min-w-0 items-center sm:w-auto">
							<Dialog.Root>
								<Dialog.Trigger>
									<img
										src={`/tracks/icons/${trackList.find((track) => track._id === selectedRace?.trackStartId)?.img}.png`}
										alt={trackList.find((track) => track._id === selectedRace?.trackStartId)?.name}
										class="h-24 hover:cursor-pointer"
									/>
								</Dialog.Trigger>
								<Dialog.Content class="md:min-w-4xl">
									<Dialog.Title>{getTrackName(trackList, selectedRace.trackStartId)}</Dialog.Title>
									<Dialog.Description>
										<img
											src={`/tracks/locations/${trackList.find((track) => track._id === selectedRace?.trackStartId)?.img}.jpg`}
											alt={getTrackName(trackList, selectedRace.trackStartId)}
											class="min-w-full"
										/>
									</Dialog.Description>
								</Dialog.Content>
							</Dialog.Root>
							<div class="flex flex-col gap-1.5">
								<div class="flex items-center gap-2 leading-none font-semibold">
									<div class="text-4xl">{getTrackName(trackList, selectedRace.trackStartId)}</div>
									{#if selectedRace?.trackStartId !== selectedRace?.trackEndId}
										<div><MoveRightIcon /></div>
										<div>{getTrackName(trackList, selectedRace.trackEndId)}</div>
									{/if}
								</div>
								<div class="text-muted-foreground text-sm">
									Race {selectedRace?.order + 1} of Grand Prix {grandPrixDetails?.order}.
								</div>
							</div>
						</div>
						<EditTrackButton race={selectedRace} />
					</div>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-col gap-8">
						<QueryNotice
							error={stats.error}
							loading={stats.isLoading}
							label="track forecasts"
							retry={stats.retry}
							empty={!selectedRaceStats?.stats.length
								? 'No forecast history for this track yet.'
								: ''}
						/>
						{#if selectedRaceStats}
							<div class="flex flex-col gap-2">
								<div class="flex flex-col gap-1.5">
									<div class="flex items-center gap-2 leading-none font-semibold">
										Average finish
									</div>
									<div class="text-muted-foreground text-sm">
										Recorded finishes from three-lap races on <b
											>{getTrackName(trackList, selectedRace?.trackEndId)}</b
										>
									</div>
								</div>
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head class="w-20 md:w-32">Racer</Table.Head>
											<Table.Head class="w-32 text-center">Avg. finish</Table.Head>
											<Table.Head class="w-32 text-center">Last 5 avg.</Table.Head>
											<Table.Head class="w-24 text-center">Trend</Table.Head>
											<Table.Head class="w-48 text-center">Consistency</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each selectedRaceStats.stats as { userId, bestResult, avg, lastFiveResults }, i (i)}
											{@const name = getPlayerName(playerList, userId)}
											{@const lastFiveAverage =
												lastFiveResults.reduce((a, b) => a + b, 0) / lastFiveResults.length}
											<Table.Row>
												<Table.Cell class="font-medium">{name}</Table.Cell>
												<Table.Cell class="flex items-center justify-center text-center text-black">
													<div
														class="flex w-20 items-center justify-center rounded-sm text-center text-lg text-black"
														style="background-color: {getPositionColour(avg)}"
													>
														{(avg ?? 0).toFixed(2) || '-'}
													</div></Table.Cell
												>
												<Table.Cell class="w-44 py-0 text-center text-black">
													<div class="flex h-full items-center justify-center gap-2">
														{#each lastFiveResults as result, resultIndex (resultIndex)}
															<PositionBadge position={result} class="size-8" />
														{/each}
													</div>
												</Table.Cell>

												<Table.Cell class="w-44 py-0 text-center text-black">
													{@const trend = avg - lastFiveAverage}
													{#if trend > 0.5}
														<div class="flex items-center justify-center gap-2 text-green-600">
															<MoveUpRightIcon />+{trend.toFixed(1)}
														</div>
													{:else if trend < -0.5}
														<div class="flex items-center justify-center gap-2 text-red-600">
															<MoveDownRightIcon />{trend.toFixed(1)}
														</div>
													{:else if trend >= 0}
														<div class="flex items-center justify-center gap-2 text-yellow-500">
															<MoveRightIcon />+{trend.toFixed(1)}
														</div>
													{:else if trend <= 0}
														<div class="flex items-center justify-center gap-2 text-yellow-400">
															<MoveRightIcon />{trend.toFixed(1)}
														</div>
													{/if}
												</Table.Cell>
												<Table.Cell class="text-center text-white">
													<Progress
														value={calculateConsistency(lastFiveResults) * 100}
														class="bg-neutral-800"
														indicatorColour={getConsistencyColorGradient(
															calculateConsistency(lastFiveResults)
														)}
													/>
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</div>
							<Separator orientation="horizontal" />
							{#if selectedRaceStats.chances?.length}<RaceWinChanceChart
									data={selectedRaceStats.chances}
								/>{/if}
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title>Update Results</Card.Title>
				</Card.Header>
				<Card.Content>
					<div
						class="flex flex-wrap items-end gap-2 md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_auto]"
					>
						<div class="min-w-0">
							<Select.Root
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
								type="single"
								bind:value={selectedUserId}
							>
								<Select.Label>Racer</Select.Label>
								<Select.Trigger class="w-[100px] overflow-hidden md:w-full"
									><span class="truncate">{selectedUser?.name}</span></Select.Trigger
								>
								<Select.Content class="md:max-w-16">
									{#each grandPrixDetails.participants as participant, i (i)}
										<Select.Item value={participant.toString()}
											>{getPlayerName(playerList, participant)}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="min-w-0">
							<Select.Root
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
								type="single"
								bind:value={selectedRaceId}
							>
								<Select.Label>Race</Select.Label>
								<Select.Trigger class="w-[240px] overflow-hidden md:w-full">
									<span class="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap"
										>{selectedRace.order + 1}.
										{#if selectedRace?.trackStartId === selectedRace?.trackEndId}
											{getTrackName(trackList, selectedRace.trackStartId)}
										{:else}
											{getTrackName(trackList, selectedRace.trackStartId)}
											<MoveRightIcon />
											{getTrackName(trackList, selectedRace.trackEndId)}
										{/if}
									</span></Select.Trigger
								>
								<Select.Content>
									{#each raceList.data as { _id, trackStartId, trackEndId, order }, i (i)}
										{#if trackStartId === trackEndId}
											<Select.Item value={_id}
												>{order + 1}. {getTrackName(trackList, trackStartId)}</Select.Item
											>
										{:else}
											<Select.Item
												value={_id}
												class="group flex items-center gap-2 text-white hover:text-black"
												>{order + 1}. {getTrackName(trackList, trackStartId)}
												<MoveRightIcon class="text-white group-data-[highlighted]:text-black" />
												{getTrackName(trackList, trackEndId)}</Select.Item
											>
										{/if}
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<div class="min-w-0">
							<Select.Root
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
								type="single"
								bind:value={selectedCharacterId}
							>
								<Select.Label>Character</Select.Label>
								<Select.Trigger class="w-[160px] overflow-hidden md:w-full">
									<span class="truncate"
										>{selectedCharacterId &&
											getCharacterName(characterList, selectedCharacterId)}</span
									>
								</Select.Trigger>
								<Select.Content>
									{#each characterList as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="min-w-0">
							<Select.Root
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
								type="single"
								bind:value={selectedKartId}
							>
								<Select.Label>Kart</Select.Label>
								<Select.Trigger class="w-[160px] overflow-hidden md:w-full">
									<span class="truncate"
										>{selectedKart && getKartName(kartList, selectedKartId)}</span
									>
								</Select.Trigger>
								<Select.Content>
									{#each kartList as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex w-20 shrink-0 flex-col">
							<Label for="finish-position" class="text-muted-foreground px-2 py-1.5 text-xs"
								>Pos</Label
							>
							<Input
								id="finish-position"
								inputmode="numeric"
								placeholder="1–24"
								bind:value={finishPosition}
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
							/>
						</div>
						<div class="flex shrink-0 flex-col">
							<Button
								variant="secondary"
								class="cursor-pointer"
								disabled={isSavingResult || liveGp.error || liveGp.isLoading}
								onclick={submitRaceResults}>{isSavingResult ? 'Saving…' : 'Submit'}</Button
							>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<div class="flex flex-col gap-2 md:flex-row">
				<Card.Root class="min-w-40">
					<Card.Header>
						<Card.Title>Standings</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="flex w-full flex-col gap-2">
							<QueryNotice
								error={standings.error}
								loading={standings.isLoading}
								label="standings"
								retry={standings.retry}
								empty={standings.data?.length === 0 ? 'No standings yet.' : ''}
							/>
							{#if standings.data}
								{#each standings.data as { userId, points, position }, i (userId)}
									{@const characterKart = playerMostUsedCharacterKart?.find(
										(player) => player.userId === userId
									)}
									{@const characterImage =
										characterKart?.character &&
										getCharacterImage(characterList, characterKart.character!)}
									{@const kartImage =
										characterKart?.kart && getKartImage(kartList, characterKart.kart!)}
									<div class="flex grow flex-col gap-2">
										<div class="flex items-center gap-2 text-sm font-medium">
											<PositionBadge {position} />
											{getPlayerName(playerList, userId)}
										</div>
										<div class="flex items-center justify-between text-lg">
											<div>{points}</div>
											{#if i !== 0}
												<div class="text-sm text-red-500">
													(-{standings.data[i - 1].points - points})
												</div>
											{/if}
										</div>
										<div class="flex justify-between">
											{#if characterImage}<img
													src={`/characters/${characterImage}.png`}
													alt=""
													class="h-10"
												/>{/if}
											{#if kartImage}<img
													src={`/karts/${kartImage}.png`}
													alt=""
													class="h-10"
												/>{/if}
										</div>

										<Separator />
									</div>
								{/each}
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
				<Card.Root class="min-w-0 flex-1">
					<div class="flex justify-between px-6">
						<Tabs.Root bind:value={tab}>
							<Tabs.List>
								<Tabs.Trigger value="results">Results</Tabs.Trigger>
								<Tabs.Trigger value="cumulative">Cumulative</Tabs.Trigger>
								<Tabs.Trigger value="expected">xPoints</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>
						<!--
				<Button
					variant="outline"
					onclick={() => fetch('/api/grandprix/40/user/6', { method: 'POST' })}
				>
					Add User
				</Button>
				-->
					</div>
					<Card.Header class="flex justify-between">
						<div class="flex flex-col gap-1.5">
							<Card.Title>Grand Prix {grandPrixDetails.order}</Card.Title>
							{#if tab === 'expected'}
								<Card.Description
									>Points gained or lost against expectations in each race.</Card.Description
								>
							{:else if tab === 'cumulative'}
								<Card.Description
									>Cumulative points for Grand Prix {grandPrixDetails.order}.</Card.Description
								>
							{:else}
								<Card.Description
									>Race Results for Grand Prix {grandPrixDetails.order}.</Card.Description
								>
							{/if}
						</div>
					</Card.Header>
					<div class="px-6">
						<QueryNotice
							error={resultsTable.error}
							loading={resultsTable.isLoading}
							label="recorded results"
							retry={resultsTable.retry}
							empty={resultsTable.data?.length === 0 ? 'No results yet.' : ''}
						/>
					</div>
					{#if tab === 'expected'}
						<Card.Content>
							<QueryNotice
								error={stats.error}
								loading={stats.isLoading}
								label="expected points"
								retry={stats.retry}
							/>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-8">#</Table.Head>
										<Table.Head class="min-w-36">Race</Table.Head>
										{#each grandPrixDetails.participants as playerId (playerId)}
											<Table.Head class="text-center"
												>{getPlayerName(playerList ?? [], playerId)}</Table.Head
											>
										{/each}
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each raceComparisons as { race, comparisons } (race._id)}
										<Table.Row>
											<Table.Cell>{race.order + 1}</Table.Cell>
											<Table.Cell>
												<a
													class="hover:text-primary focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
													href={`/grandprix/${grandPrixDetails._id}?track=${race._id}`}
												>
													{#if race.trackStartId !== race.trackEndId}
														<span class="flex items-center gap-1 text-xs"
															>{getTrackName(trackList ?? [], race.trackStartId)}
															<MoveRightIcon class="size-3 shrink-0" /></span
														>
													{/if}
													{getTrackName(trackList ?? [], race.trackEndId)}
												</a>
											</Table.Cell>
											{#each comparisons as comparison (comparison.userId)}
												<Table.Cell
													class={cn(
														'text-center',
														comparison.difference != null &&
															(Math.abs(comparison.difference) >= 4 ? 'text-white' : 'text-black')
													)}
													style={`background-color: ${comparisonColour(comparison.difference)}`}
													>{@render comparisonCell(comparison)}</Table.Cell
												>
											{/each}
										</Table.Row>
									{/each}
								</Table.Body>
								<Table.Footer>
									<Table.Row>
										<Table.Head colspan={2} scope="row">Total so far</Table.Head>
										{#each pointsComparison ?? [] as comparison (comparison.userId)}
											<Table.Cell
												class={cn(
													'text-center',
													comparison.difference != null &&
														(Math.abs(comparison.difference) >= 4 ? 'text-white' : 'text-black')
												)}
												style={`background-color: ${comparisonColour(comparison.difference)}`}
												>{@render comparisonCell(comparison)}</Table.Cell
											>
										{/each}
									</Table.Row>
								</Table.Footer>
							</Table.Root>
						</Card.Content>
					{:else if tab === 'cumulative' || tab === 'results'}
						<ScrollArea class="w-full min-w-0" orientation="horizontal">
							<Card.Content>
								<Table.Root class="table-fixed">
									<Table.Header>
										<Table.Row>
											<Table.Head class="w-8"><div>#</div></Table.Head>
											<Table.Head class="w-48"><div class="">Race</div></Table.Head>
											{#each grandPrixDetails.participants as playerId, i (i)}
												<Table.Head class="w-16 min-w-16 text-center md:w-full"
													><div>{getPlayerName(playerList, playerId)}</div></Table.Head
												>
											{/each}
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each cumulativeRows as { order, trackStartId, trackEndId, _id, cells } (_id)}
											<Table.Row>
												<Table.Cell class="">{Number(order) + 1}</Table.Cell>
												{#if trackStartId === trackEndId}
													<Table.Cell
														class="cursor-pointer hover:text-white/60"
														onclick={() => (selectedRaceId = _id)}
														>{getTrackName(trackList, trackStartId)}</Table.Cell
													>
												{:else}
													<Table.Cell
														class="flex cursor-pointer items-center gap-1.5 hover:text-white/60"
														onclick={() => (selectedRaceId = _id)}
													>
														<div><RouteIcon /></div>
														<div class="flex-col items-center justify-center text-xs">
															<div>{getTrackName(trackList, trackStartId)}</div>
															<div>{getTrackName(trackList, trackEndId)}</div>
														</div>
													</Table.Cell>
												{/if}

												{#each cells as { userId, position, total, rank } (userId)}
													{@const colourPosition = tab === 'cumulative' ? rank : position}
													<Table.Cell
														class={cn(
															'text-center font-medium tabular-nums',
															position != null &&
																(colourPosition === 1
																	? 'bg-yellow-400 text-black'
																	: colourPosition === 2
																		? 'bg-gray-300 text-black'
																		: colourPosition === 3
																			? 'bg-yellow-600 text-black'
																			: '')
														)}
													>
														{position == null ? '—' : tab === 'cumulative' ? total : position}
													</Table.Cell>
												{/each}
											</Table.Row>
										{/each}
									</Table.Body>
									<Table.Footer>
										<Table.Row>
											<Table.Head colspan={2} scope="row"
												>{tab === 'cumulative' ? 'Total points' : 'Points'}</Table.Head
											>
											{#each grandPrixDetails.participants as playerId (playerId)}
												{@const points =
													cumulativeRows.at(-1)?.cells.find((cell) => cell.userId === playerId)
														?.total ?? 0}
												<Table.Cell class="text-center tabular-nums">{points}</Table.Cell>
											{/each}
										</Table.Row>
									</Table.Footer>
								</Table.Root>
							</Card.Content>
						</ScrollArea>
					{/if}
				</Card.Root>
			</div>

			<Card.Root>
				<Card.Header>
					<Card.Title>Grand Prix stats</Card.Title>
					<Card.Description>
						{#if gpOutlook}{gpOutlook.completedRaces} of {gpOutlook.totalRaces} races fully recorded ·
							{grandPrixDetails.participants.length} racers{:else}{grandPrixDetails.participants
								.length} racers{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-3">
					<StatisticsHelp scope="gp" />
					<p class="text-muted-foreground text-xs">
						xPoints and win chances give each racer’s latest 10 finishes on each track full weight.
						Each older finish carries 10% less weight than the one before it.
					</p>
					<QueryNotice
						error={stats.error}
						loading={stats.isLoading}
						label="Grand Prix forecasts"
						retry={stats.retry}
					/>
					<QueryNotice
						error={startingStats.error}
						loading={startingStats.isLoading}
						label="starting forecasts"
						retry={startingStats.retry}
					/>
					{#if gpOutlook}
						<Table.Root aria-label="Grand Prix stats">
							<Table.Header>
								<Table.Row>
									<Table.Head></Table.Head>
									<Table.Head colspan={2} scope="colgroup" class="border-l text-center"
										>Starting stats</Table.Head
									>
									<Table.Head colspan={4} scope="colgroup" class="border-l text-center"
										>Ongoing stats</Table.Head
									>
								</Table.Row>
								<Table.Row>
									{#each outlookColumns as column (column.key)}
										<Table.Head
											class={cn(
												column.key === 'name' ? '' : 'text-right',
												(column.key === 'startingProjected' || column.key === 'points') &&
													'border-l'
											)}
											aria-sort={outlookSort.key === column.key
												? outlookSort.direction === 'asc'
													? 'ascending'
													: 'descending'
												: 'none'}
										>
											<Button
												variant="ghost"
												size="sm"
												class="-mx-2 gap-1 px-2 text-xs"
												aria-label={`Sort by ${column.group ? `${column.group} ` : ''}${column.label}`}
												onclick={() => sortOutlook(column.key)}
											>
												{column.label}
												{#if outlookSort.key !== column.key}<ArrowUpDownIcon
														class="text-muted-foreground size-3.5"
													/>{:else if outlookSort.direction === 'asc'}<ArrowUpIcon
														class="size-3.5"
													/>{:else}<ArrowDownIcon class="size-3.5" />{/if}
											</Button>
										</Table.Head>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each sortedOutlook as player (player.userId)}
									<Table.Row>
										{#each outlookColumns as column (column.key)}
											{@const value = player[column.key]}
											<Table.Cell
												class={cn(
													column.key === 'name' ? 'font-medium' : 'text-right tabular-nums',
													(column.key === 'startingProjected' || column.key === 'points') &&
														'border-l'
												)}
											>
												{value == null
													? '—'
													: typeof value === 'number'
														? `${Number(value.toFixed(1))}${column.key === 'winChance' || column.key === 'startingWinChance' ? '%' : ''}`
														: value}
											</Table.Cell>
										{/each}
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Card.Content>
			</Card.Root>

			{#if chartData}
				<Card.Root>
					<Card.Header>
						<Card.Title>Combined Stats</Card.Title>
						<Card.Description
							>Based on each players most used character and kart combination.</Card.Description
						>
					</Card.Header>
					<Card.Content class=" max-w-5xl py-4">
						<Chart.Container config={chartConfig} class="h-64 w-full">
							<BarChart
								bind:context
								data={chartData}
								xScale={scaleBand().padding(0.1)}
								x="stat"
								axis="x"
								series={chartKeys}
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
											y: {
												type: 'tween',
												duration: prefersReducedMotion.current ? 0 : 500,
												easing: cubicInOut
											},
											height: {
												type: 'tween',
												duration: prefersReducedMotion.current ? 0 : 500,
												easing: cubicInOut
											}
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
			{/if}
		</div>
	{/if}
</div>
