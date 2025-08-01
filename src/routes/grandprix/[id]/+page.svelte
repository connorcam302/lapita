<script lang="ts">
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
	import { scaleBand } from 'd3-scale';
	import { BarChart, type ChartContextValue } from 'layerchart';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { characterDataset, kartDataset } from '$lib/data/StatsDataset';

	const { data }: { data: PageData } = $props();
	const client = useConvexClient();

	let tab = $state('results');

	let { grandPrixDetails } = data;

	let kartList = $derived(convexStore.allKarts);
	let characterList = $derived(convexStore.allCharacters);
	let playerList = $derived(convexStore.allUsers);
	let trackList = $derived(convexStore.allTracks);

	let raceList = $derived(
		useQuery(api.races.inGrandPrix, { grandPrixId: grandPrixDetails!._id as Id<'grandPrix'> })
	);
	let standings = $derived(
		useQuery(api.standings.getOne, {
			grandPrixId: grandPrixDetails!._id as Id<'grandPrix'>
		})
	);

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
	let selectedUserId = $derived(
		playerList &&
			((grandPrixDetails.participants.find((id) => id === localStorage.getItem('selectedUserId')) ??
				playerList[0]!._id) as Id<'users'>)
	);
	let selectedUser = $derived(
		playerList?.find((racer) => racer._id === (selectedUserId as Id<'users'>))
	);
	let selectedRaceId = $derived(
		!raceList.isLoading &&
			((page.url.searchParams.get('track') || raceList?.data[0]!._id) as Id<'races'>)
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

	let tableColours = $state(page.url.searchParams.get('results-view') || 'medals');

	let finishPosition = $state('');

	const resultsTable = $derived(
		!raceList.isLoading && useQuery(api.results.get, { grandPrixId: grandPrixDetails?._id })
	);

	const getPlayerMostUsedCharacterKart = (
		userId: Id<'users'>,
		stats: FunctionReturnType<typeof api.results.get>
	) => {
		if (!stats) return;
		const userResults = stats
			.map((race) => race.results.find((result) => result.userId === userId))
			.filter((result) => Object.hasOwn(result, 'kartId') && Object.hasOwn(result, 'characterId'));

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
	$effect(() => {
		tableColours && localStorage.setItem('tableColours', tableColours);
	});

	const submitRaceResults = () => {
		if (
			!grandPrixDetails._id ||
			!selectedRaceId ||
			!selectedUserId ||
			!selectedKartId ||
			!selectedCharacterId
		)
			return toast.error('Something went wrong', {
				description: 'Try again in a few seconds. Refresh if error persists.'
			});
		if (!finishPosition) {
			return toast.error('Missing fields', {
				description: 'Please fill out finish position.'
			});
		}
		client
			.mutation(api.results.update, {
				grandPrixId: grandPrixDetails?._id,
				raceId: selectedRaceId,
				position: Number(finishPosition),
				userId: selectedUserId,
				kartId: selectedKartId,
				characterId: selectedCharacterId
			})
			.then((res) => {
				if (res?.status === 'Ok') {
					const currentRaceIndex = raceList.data.findIndex((race) => race._id === selectedRaceId);
					selectedRaceId = raceList.data[currentRaceIndex + 1]._id;
					finishPosition = '';
					return toast.success('Uploaded Result', {
						description: `Result successfully uploaded.`
					});
				} else {
					return toast.error('Something went wrong', {
						description: 'Try again in a few seconds. Refresh if error persists.'
					});
				}
			});
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
					dataPoint[playerName] = characterStats[statKey] + kartStats[statKey];
				});

				return dataPoint;
			})
	);

	const chartConfig =
		grandPrixDetails &&
		(grandPrixDetails.participants.reduce((acc, userId) => {
			acc[getPlayerName(playerList, userId)] = {
				label: getPlayerName(playerList, userId),
				color: '#f5cd30' // or however you generate random colors
			};
			return acc;
		}, {}) satisfies Chart.ChartConfig);
	let context = $state<ChartContextValue>();

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

	$inspect(chartConfig);
	$inspect(chartKeys);
	$inspect(chartData);

	let initialLoading = $derived(
		raceList.isLoading || standings.isLoading || resultsTable.isLoading || !selectedRaceStats
	);
	let errors = $derived(
		[raceList, standings, resultsTable].map(({ error }) => error).filter((error) => error)
	);
</script>

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
													{#each lastFiveResults as result}
														<div
															class="flex h-8 w-8 items-center justify-center rounded-sm text-center text-black"
															style="background-color: {getPositionColour(result)}"
														>
															{result}
														</div>
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
							<Select.Root type="single" bind:value={selectedUserId}>
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
							<Select.Root type="single" bind:value={selectedRaceId}>
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
							<Select.Root type="single" bind:value={selectedCharacterId}>
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
							<Select.Root type="single" bind:value={selectedKartId}>
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
							<Label class="text-muted-foreground px-2 py-1.5 text-xs">Pos</Label>
							<Input placeholder="##" bind:value={finishPosition} />
						</div>
						<div class="flex w-32 flex-col">
							<Button variant="secondary" class="cursor-pointer" onclick={() => submitRaceResults()}
								>Submit</Button
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
										<div class="text-sm font-medium">
											{#if i !== 0 && points === standings.data[i - 1].points}
												{position}. {getPlayerName(playerList, userId)}
											{:else}
												{position}. {getPlayerName(playerList, userId)}
											{/if}
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
				<Card.Root>
					<div class="flex justify-between px-6">
						<Tabs.Root bind:value={tab}>
							<Tabs.List>
								<Tabs.Trigger value="results">Results</Tabs.Trigger>
								<Tabs.Trigger value="cumulative">Cumulative</Tabs.Trigger>
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
							{#if tab === 'standings'}
								<Card.Description
									>Cumulative points for Grand Prix {grandPrixDetails.order}.</Card.Description
								>
							{:else}
								<Card.Description
									>Race Results for Grand Prix {grandPrixDetails.order}.</Card.Description
								>
							{/if}
						</div>
						<Button
							variant="outline"
							onclick={() => (tableColours = tableColours === 'medals' ? 'scale' : 'medals')}
						>
							{#if tableColours === 'medals'}
								<div class="flex">
									<div class="h-4 w-4 bg-amber-300"></div>
									<div class="h-4 w-4 bg-gray-300"></div>
									<div class="h-4 w-4 bg-yellow-600"></div>
								</div>
							{:else}
								<div class="flex">
									<div class="h-4 w-4 bg-green-700"></div>
									<div class="h-4 w-4 bg-amber-400"></div>
									<div class="h-4 w-4 bg-red-700"></div>
								</div>
							{/if}
						</Button>
					</Card.Header>
					{#if tab === 'cumulative'}{:else if tab === 'results'}
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
										{#each resultsTable.data as { order, trackStartId, trackEndId, _id, results }, i (i)}
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

												{#each results as { _id, userId, position }, j (j)}
													{#if tableColours === 'scale'}
														<Table.Cell
															class="text-center text-black"
															style="background-color: {getPositionColour(position)}"
														>
															{position}
														</Table.Cell>
													{:else if tableColours === 'medals'}
														{#if position === 1}
															<Table.Cell class="bg-yellow-400 text-center text-black">
																{position}
															</Table.Cell>
														{:else if position === 2}
															<Table.Cell class="bg-gray-300 text-center text-black">
																{position}
															</Table.Cell>
														{:else if position === 3}
															<Table.Cell class="bg-yellow-600 text-center text-black">
																{position}
															</Table.Cell>
														{:else}
															<Table.Cell class="text-center text-white">
																{position}
															</Table.Cell>
														{/if}
													{/if}
												{/each}
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</Card.Content>
						</ScrollArea>
					{/if}
				</Card.Root>
			</div>

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
