<script lang="ts">
	import ManageGP from './ManageGP.svelte';
	import { ConvexError } from 'convex/values';
	import { isValidFinishPosition } from '$lib/grand-prix';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import { calculateExpectedPoints, calculatePointsComparison } from './expected-points';
	import { calculateGpOutlook } from './gp-outlook';
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
	import { goto } from '$app/navigation';
	import RaceWinChanceChart from './RaceWinChanceChart.svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import MoveDownRight from '@lucide/svelte/icons/move-down-right';
	import MoveUpRight from '@lucide/svelte/icons/move-up-right';
	import { Progress } from '$lib/components/ui/progress/index.ts';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient, useQuery } from 'convex-svelte';
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

	let kartList = $derived(convexStore.allKarts);
	let characterList = $derived(convexStore.allCharacters);
	let playerList = $derived(convexStore.allUsers);
	let trackList = $derived(convexStore.allTracks);

	let raceList = $derived(
		useQuery(api.races.inGrandPrix, { grandPrixId: grandPrixDetails!._id as Id<'grandPrix'> })
	);

	$inspect(raceList);
	let standings = $derived(
		useQuery(api.standings.getOne, {
			grandPrixId: grandPrixDetails!._id as Id<'grandPrix'>
		})
	);

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
		!raceList.isLoading &&
			((page.url.searchParams.get('track') || raceList.data?.[0]?._id) as Id<'races'>)
	);

	let selectedRace = $derived(
		!raceList.isLoading ? raceList?.data?.find((track) => track._id === selectedRaceId) : null
	);

	let stats = $derived(
		!raceList.isLoading &&
			useQuery(api.results.stats, {
				tracks: raceList.data.map((race) => race.trackEndId),
				users: grandPrixDetails.participants
			})
	);

	let selectedRaceStats = $derived(
		stats && !stats.isLoading && selectedRaceId
			? stats.data.find((stat) => {
					return stat.trackId === selectedRace?.trackEndId;
				})
			: undefined
	);

	let finishPosition = $state('');
	let isSavingResult = $state(false);

	const resultsTable = $derived(
		!raceList.isLoading && useQuery(api.results.get, { grandPrixId: grandPrixDetails?._id })
	);

	const cumulativeRows = $derived(
		calculateCumulativePoints(
			grandPrixDetails.participants,
			resultsTable && resultsTable.data ? resultsTable.data : []
		)
	);

	const expectedPoints = $derived(
		resultsTable && resultsTable.data && stats && stats.data
			? calculateExpectedPoints(grandPrixDetails.participants, resultsTable.data, stats.data)
			: undefined
	);

	const gpOutlook = $derived(
		resultsTable && resultsTable.data && stats && stats.data
			? calculateGpOutlook(grandPrixDetails.participants, resultsTable.data, stats.data)
			: undefined
	);

	const outlookColumns = [
		{ key: 'name', label: 'Racer' },
		{ key: 'points', label: 'Points' },
		{ key: 'remaining', label: 'Races left' },
		{ key: 'projected', label: 'Projected' },
		{ key: 'minimum', label: 'Min points' },
		{ key: 'maximum', label: 'Max points' },
		{ key: 'winChance', label: 'Win GP' },
		{ key: 'podiumChance', label: 'Podium' }
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
	const sortedOutlook = $derived(
		(gpOutlook?.players ?? [])
			.map((player) => ({ ...player, name: getPlayerName(playerList ?? [], player.userId) }))
			.sort((a, b) => {
				const first = a[outlookSort.key];
				const second = b[outlookSort.key];
				// Keep unavailable forecasts last in either direction.
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
			})
	);

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

	$inspect(resultsTable);

	const getPlayerMostUsedCharacterKart = (
		userId: Id<'users'>,
		stats: FunctionReturnType<typeof api.results.get>
	) => {
		if (!stats) return;
		const userResults = stats
			.map((race) => race.results.find((result) => result.userId === userId))
			.filter(
				(result) =>
					result && Object.hasOwn(result, 'kartId') && Object.hasOwn(result, 'characterId')
			);

		if (userResults.length === 0) return;

		const kartUsageCount = userResults.reduce((acc, curr) => {
			acc[curr.kartId] = (acc[curr.kartId] || 0) + 1;
			return acc;
		}, {});

		const mostUsedKartId = Object.entries(kartUsageCount).reduce((a, b) => {
			return b[1] > a[1] ? b : a;
		})[0];

		const userMostUsedKart = userResults.find((result) => result.kartId === mostUsedKartId);

		const characterUsageCount = userResults.reduce((acc, curr) => {
			acc[curr.characterId] = (acc[curr.characterId] || 0) + 1;
			return acc;
		}, {});

		const mostUsedCharacterId = Object.entries(characterUsageCount).reduce((a, b) => {
			return b[1] > a[1] ? b : a;
		})[0];

		const userMostUsedCharacter = userResults.find(
			(result) => result.characterId === mostUsedCharacterId
		);

		return { kart: userMostUsedKart?.kartId, character: userMostUsedCharacter?.characterId };
	};

	const playerMostUsedCharacterKart = $derived(
		!resultsTable.isLoading &&
			resultsTable.data &&
			grandPrixDetails.participants.map((userId) => {
				return {
					userId,
					...getPlayerMostUsedCharacterKart(userId, resultsTable.data)
				};
			})
	);

	$effect(() => {
		if (!selectedRaceId) return;
		goto(`/grandprix/${grandPrixDetails?._id}?track=${selectedRaceId}`, { noScroll: true });
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
		if (isSavingResult) return;
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
		} catch (error) {
			toast.error('Could not save result', {
				description:
					error instanceof ConvexError && typeof error.data === 'string'
						? error.data
						: 'Try again. Your selections have been kept.'
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
	];

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

	const chartData = $derived(
		playerMostUsedCharacterKart &&
			playerMostUsedCharacterKart.filter(
				(result) => Object.hasOwn(result, 'kart') && Object.hasOwn(result, 'character')
			).length === grandPrixDetails.participants.length &&
			statNames.map((statKey) => {
				console.log(
					playerMostUsedCharacterKart.filter(
						(result) => Object.hasOwn(result, 'kart') && Object.hasOwn(result, 'character')
					)
				);
				const dataPoint = { stat: statLabels[statKey] };

				// Add each user's stat value using their name as the key
				grandPrixDetails.participants.forEach((userId) => {
					const playerCharacterKart = playerMostUsedCharacterKart.find(
						(player) => player.userId === userId
					);
					const characterName = getCharacterName(characterList, playerCharacterKart?.character);
					const kartName = getKartName(kartList, playerCharacterKart?.kart);

					const characterStats = characterDataset.getByName(characterName);
					const kartStats = kartDataset.getByName(kartName);

					const playerName = getPlayerName(playerList, userId);

					console.log(characterName, kartName);
					dataPoint[playerName] = characterStats[statKey] + kartStats[statKey];
				});

				return dataPoint;
			})
	);

	const chartConfig = $derived(
		grandPrixDetails &&
			(grandPrixDetails.participants.reduce((acc, userId) => {
				acc[getPlayerName(playerList, userId)] = {
					label: getPlayerName(playerList, userId),
					color: '#f5cd30' // or however you generate random colors
				};
				return acc;
			}, {}) satisfies Chart.ChartConfig)
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

	let initialLoading = $derived(
		raceList.isLoading || standings.isLoading || resultsTable.isLoading || !selectedRaceStats
	);
	let errors = $derived(
		[raceList, standings, resultsTable].map(({ error }) => error).filter((error) => error)
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

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if initialLoading}
		<div class="flex h-dvh items-center justify-center">
			<img src="/lapita-logo.png" class="w-48 animate-bounce" alt="lapita-logo" />
		</div>
	{:else if errors.length}
		<div>Something went wrong. Looks like this:</div>
		<div class="flex flex-col gap-8">
			{#each errors as error}
				<div class="flex flex-col gap-2">
					<div class="font-medium">{error!.name}</div>
					<div class="text-sm">{error!.message}</div>
					<div class="text-sm">{error!.cause}</div>
					<div class="text-sm">{error!.stack}</div>
				</div>
			{/each}
		</div>
	{:else}
		<div
			class="mx-auto flex max-w-4xl flex-col gap-2 px-2 py-8"
			transition:fade|global={{ duration: 500, easing: cubicIn }}
		>
			<ManageGP grandPrix={grandPrixDetails} players={playerList ?? []} />
			<Card.Root>
				<Card.Header>
					<div class="flex justify-between">
						<div class="flex items-center">
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
											alt={selectedRace?.startTrackName}
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
						<div class="flex flex-col gap-2">
							<div class="flex flex-col gap-1.5">
								<div class="flex items-center gap-2 leading-none font-semibold">
									Average Placement
								</div>
								<div class="text-muted-foreground text-sm">
									Average placement to 2 d.p on <b
										>{getTrackName(trackList, selectedRace?.trackEndId)}</b
									>
								</div>
							</div>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="w-20 md:w-32">Racer</Table.Head>
										<Table.Head class="w-32 text-center">Average</Table.Head>
										<Table.Head class="w-32 text-center">Last 5</Table.Head>
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
						<RaceWinChanceChart data={selectedRaceStats?.chances} />
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title>Update Results</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex flex-wrap items-end gap-2 md:flex-nowrap">
						<div>
							<Select.Root disabled={isSavingResult} type="single" bind:value={selectedUserId}>
								<Select.Label>Racer</Select.Label>
								<Select.Trigger class="w-[100px]">{selectedUser?.name}</Select.Trigger>
								<Select.Content class="md:max-w-16">
									{#each grandPrixDetails.participants as participant, i (i)}
										<Select.Item value={participant.toString()}
											>{getPlayerName(playerList, participant)}</Select.Item
										>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div>
							<Select.Root disabled={isSavingResult} type="single" bind:value={selectedRaceId}>
								<Select.Label>Race</Select.Label>
								<Select.Trigger class="w-[240px] truncate overflow-hidden text-ellipsis">
									{selectedRace.order + 1}.
									{#if selectedRace?.trackStartId === selectedRace?.trackEndId}
										{getTrackName(convexStore.allTracks, selectedRace.trackStartId)}
									{:else}
										{getTrackName(convexStore.allTracks, selectedRace.trackStartId)}
										<MoveRightIcon />
										{getTrackName(convexStore.allTracks, selectedRace.trackEndId)}
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each raceList.data as { _id, trackStartId, trackEndId, order }, i (i)}
										{#if trackStartId === trackEndId}
											<Select.Item value={_id}
												>{order + 1}. {getTrackName(
													convexStore.allTracks,
													trackStartId
												)}</Select.Item
											>
										{:else}
											<Select.Item
												value={_id}
												class="group flex items-center gap-2 text-white hover:text-black"
												>{order + 1}. {getTrackName(convexStore.allTracks, trackStartId)}
												<MoveRightIcon class="text-white group-data-[highlighted]:text-black" />
												{getTrackName(convexStore.allTracks, trackEndId)}</Select.Item
											>
										{/if}
									{/each}
								</Select.Content>
							</Select.Root>
						</div>

						<div>
							<Select.Root disabled={isSavingResult} type="single" bind:value={selectedCharacterId}>
								<Select.Label>Character</Select.Label>
								<Select.Trigger class="w-[160px]">
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
							<Select.Root disabled={isSavingResult} type="single" bind:value={selectedKartId}>
								<Select.Label>Kart</Select.Label>
								<Select.Trigger class="w-[160px]">
									{selectedKart && getKartName(kartList, selectedKartId)}
								</Select.Trigger>
								<Select.Content>
									{#each kartList as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="flex flex-col">
							<Label for="finish-position" class="text-muted-foreground px-2 py-1.5 text-xs"
								>Pos</Label
							>
							<Input
								id="finish-position"
								inputmode="numeric"
								placeholder="1–24"
								bind:value={finishPosition}
								disabled={isSavingResult}
							/>
						</div>
						<div class="flex w-32 flex-col">
							<Button
								variant="secondary"
								class="cursor-pointer"
								disabled={isSavingResult}
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
							{#if standings.data && playerMostUsedCharacterKart}
								{#each standings.data as { userId, points, position }, i (userId)}
									{@const characterKart = playerMostUsedCharacterKart.find(
										(player) => player.userId === userId
									)}
									{@const characterImage =
										characterKart && getCharacterImage(characterList, characterKart.character)}
									{@const kartImage = characterKart && getKartImage(kartList, characterKart.kart)}
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
											<img src={`/characters/${characterImage}.png`} alt="" class="h-10" />
											<img src={`/karts/${kartImage}.png`} alt="" class="h-10" />
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
					{#if tab === 'expected'}
						<Card.Content>
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
						<ScrollArea class="w-96 md:w-full" orientation="horizontal">
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
														>{getTrackName(convexStore.allTracks, trackStartId)}</Table.Cell
													>
												{:else}
													<Table.Cell
														class="flex cursor-pointer items-center gap-1.5 hover:text-white/60"
														onclick={() => (selectedRaceId = _id)}
													>
														<div><RouteIcon /></div>
														<div class="flex-col items-center justify-center text-xs">
															<div>{getTrackName(convexStore.allTracks, trackStartId)}</div>
															<div>{getTrackName(convexStore.allTracks, trackEndId)}</div>
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
												>{tab === 'cumulative' ? 'Total points' : 'Expected points'}</Table.Head
											>
											{#each grandPrixDetails.participants as playerId (playerId)}
												{@const expected =
													tab === 'cumulative'
														? (cumulativeRows.at(-1)?.cells.find((cell) => cell.userId === playerId)
																?.total ?? 0)
														: expectedPoints?.get(playerId)}
												<Table.Cell class="text-center tabular-nums">
													{expected == null ? '—' : Number(expected.toFixed(1))}
												</Table.Cell>
											{/each}
										</Table.Row>
									</Table.Footer>
								</Table.Root>
							</Card.Content>
						</ScrollArea>
						{#if tab === 'results'}
							<p class="text-muted-foreground max-w-xl px-6 pb-6 text-xs">
								Projected final points: recorded finishes plus remaining races ranked by win
								probability. Equal probabilities share place points. A dash means there is not
								enough track history to predict.
							</p>
						{/if}
					{/if}
				</Card.Root>
			</div>

			<Card.Root>
				<Card.Header>
					<Card.Title>Grand Prix stats</Card.Title>
					<Card.Description>
						{#if gpOutlook}{gpOutlook.completedRaces} of {gpOutlook.totalRaces} races complete · {grandPrixDetails
								.participants.length} racers{:else}Loading stats…{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if gpOutlook}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									{#each outlookColumns as column (column.key)}
										<Table.Head
											class={column.key === 'name' ? '' : 'text-right'}
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
												aria-label={`Sort by ${column.label}`}
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
										<Table.Cell class="font-medium"
											>{getPlayerName(playerList ?? [], player.userId)}</Table.Cell
										>
										<Table.Cell class="text-right tabular-nums">{player.points}</Table.Cell>
										<Table.Cell class="text-right tabular-nums">{player.remaining}</Table.Cell>
										<Table.Cell class="text-right tabular-nums"
											>{player.projected == null
												? '—'
												: Number(player.projected.toFixed(1))}</Table.Cell
										>
										<Table.Cell class="text-right tabular-nums">{player.minimum}</Table.Cell>
										<Table.Cell class="text-right font-medium tabular-nums"
											>{player.maximum}</Table.Cell
										>
										<Table.Cell class="text-right font-medium tabular-nums"
											>{player.winChance == null
												? '—'
												: `${Number(player.winChance.toFixed(1))}%`}</Table.Cell
										>
										<Table.Cell class="text-right tabular-nums"
											>{player.podiumChance == null
												? '—'
												: `${Number(player.podiumChance.toFixed(1))}%`}</Table.Cell
										>
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
			{/if}
		</div>
	{/if}
</div>
