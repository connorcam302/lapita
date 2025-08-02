<script lang="ts">
	import { convexStore } from '$lib/stores/states.svelte.js';
	import {
		getPlayerName,
		getCharacterImage,
		getKartImage,
		getCharacterName,
		getKartName,
		getTrackImage,
		getTrackName,
		getPositionColour,
		analyzeCharacterKartCombinations
	} from '$lib/utils.js';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api.js';
	import { fade } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import TrackBars from './TrackBars.svelte';
	import CharacterKartStats from '$lib/components/custom/CharacterKartStats.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import Button from '$lib/components/ui/button/button.svelte';

	let { data } = $props();

	let { userDetails } = $derived(data);

	let allCharacters = $derived(convexStore.allCharacters);
	let allUsers = $derived(convexStore.allUsers);
	let allKarts = $derived(convexStore.allKarts);
	let allTracks = $derived(convexStore.allTracks);

	const userName = $derived(getPlayerName(allUsers, userDetails._id));

	const resultsData = $derived(
		userDetails && useQuery(api.results.getPlayer, { userId: userDetails._id })
	);

	const gpResults = $derived(
		userDetails && useQuery(api.gps.getPlayerResults, { userId: userDetails._id })
	);

	const characterKartStats = $derived(
		!resultsData?.isLoading &&
			resultsData?.data &&
			!gpResults?.isLoading &&
			gpResults?.data &&
			analyzeCharacterKartCombinations(resultsData?.data, gpResults?.data)
	);

	const characterKartCombinations = $derived(
		!resultsData?.isLoading &&
			resultsData?.data &&
			Object.entries(
				resultsData.data.reduce((acc, obj) => {
					// Create a unique key for each character-kart combination
					const combinationKey = `${obj.characterId}|${obj.kartId}`;
					acc[combinationKey] = (acc[combinationKey] || 0) + 1;
					return acc;
				}, {})
			)
				.map(([combinationKey, count]) => {
					const [characterId, kartId] = combinationKey.split('|');
					return { characterId, kartId, count };
				})
				.filter(({ characterId, kartId }) => characterId !== 'undefined' && kartId !== 'undefined')
				.sort((a, b) => b.count - a.count)
	);

	const trackCounts = $derived(
		!resultsData?.isLoading &&
			resultsData?.data &&
			Object.entries(
				resultsData.data.reduce((acc, obj) => {
					if (!acc[obj.trackEndId]) {
						acc[obj.trackEndId] = [];
					}
					acc[obj.trackEndId] = [...acc[obj.trackEndId], obj.position];
					return acc;
				}, {})
			)
				.map(([trackEndId, positions]) => ({ trackEndId, positions }))
				.map(({ trackEndId, positions }) => ({
					trackEndId,
					positions,
					average: positions.reduce((acc, position) => acc + position, 0) / positions.length
				}))
				.sort((a, b) => a.average - b.average)
	);

	let page = $state(1);

	$inspect(characterKartStats);

	let initialLoading = $derived(
		!characterKartCombinations && !trackCounts && !characterKartStats && gpResults?.isLoading
	);
	let errors = $derived([resultsData].map(({ error }) => error).filter((error) => error));
</script>

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if initialLoading}
		<div
			class="flex h-dvh items-center justify-center"
			transition:fade|global={{ duration: 500, easing: cubicIn }}
		>
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
		<div class="mx-auto max-w-4xl py-4" transition:fade|global={{ duration: 500, easing: cubicIn }}>
			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap justify-between">
					<Card.Root>
						<Card.Header>
							<Card.Title class="font-title text-2xl">
								{userName}
							</Card.Title>
						</Card.Header>
						<Card.Content>
							<div class="relative w-64">
								<img
									src={`/karts/${getKartImage(allKarts, characterKartCombinations[0].kartId)}.png`}
									class="absolute bottom-0 left-1/2 w-60 -translate-x-1/2 transform opacity-60"
									alt={characterKartCombinations[0].kartId}
								/>
								<img
									src={`/characters/${getCharacterImage(allCharacters, characterKartCombinations[0].characterId)}.png`}
									class="relative mx-auto h-40"
									alt={characterKartCombinations[0].characterId}
								/>
							</div>
						</Card.Content>
					</Card.Root>
					<Card.Root>
						<Card.Content>
							<div class="flex gap-4">
								<div class="flex flex-col gap-4">
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Races Complete</div>
										<div>
											{resultsData.data.length}
										</div>
									</div>
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Overall Average</div>
										<div
											class="flex w-20 items-center justify-center rounded-sm text-center text-lg text-black"
											style="background-color: {getPositionColour(trackCounts[0].average)}"
										>
											{(
												resultsData.data.reduce((acc, result) => acc + result.position, 0) /
												resultsData.data.length
											).toFixed(2) || '-'}
										</div>
									</div>

									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Best Track</div>
										<div>
											{getTrackName(allTracks, trackCounts[0].trackEndId)}
										</div>
									</div>
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Worst Track</div>
										<div>
											{getTrackName(allTracks, trackCounts[trackCounts.length - 1].trackEndId)}
										</div>
									</div>
								</div>
								<div class="flex flex-col gap-4">
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Grand Prix Wins</div>
										<div>
											{!gpResults?.isLoading &&
												gpResults?.data.filter((gpResult) => gpResult.position === 1).length}
										</div>
									</div>
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Most Points</div>
										<div>
											{!gpResults?.isLoading &&
												gpResults?.data?.slice().sort((a, b) => b.points - a.points)[0].points}
										</div>
									</div>
									<div class="flex flex-col gap-0.5">
										<div class="text-sm text-neutral-400">Total Wins</div>
										<div>
											{resultsData.data.filter((result) => result.position === 1).length}
										</div>
									</div>
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				</div>
				<Card.Root>
					<Card.Header>
						<Card.Title>Character & Kart Combination Stats</Card.Title>
						<Card.Description>Based on {resultsData.data.length} races.</Card.Description>
					</Card.Header>
					<Card.Content>
						<ScrollArea class="h-96">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head class="text-center">Character</Table.Head>
										<Table.Head class="text-center">Kart</Table.Head>
										<Table.Head class="text-center">Races</Table.Head>
										<Table.Head class="text-center">Avg Pos</Table.Head>
										<Table.Head class="text-center">GP Wins</Table.Head>
										<Table.Head class="text-center">Avg Points</Table.Head>
										<Table.Head class="text-center">Best</Table.Head>
										<Table.Head class="text-center">Worst</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#key characterKartStats}
										{#if characterKartStats}
											{#each characterKartStats as characterKartStat, i (i)}
												<Table.Row>
													<Table.Cell class="text-center"
														><img
															src={`/characters/${getCharacterImage(allCharacters, characterKartStat.characterId)}.png`}
															alt={characterKartStat.characterId}
															class="mx-auto max-h-10 max-w-8"
														/></Table.Cell
													>
													<Table.Cell class="text-center"
														><img
															src={`/karts/${getKartImage(allKarts, characterKartStat.kartId)}.png`}
															alt={characterKartStat.kartId}
															class="mx-auto max-w-16"
														/></Table.Cell
													>
													<Table.Cell class="text-center">{characterKartStat.raceCount}</Table.Cell>
													<Table.Cell class="text-center"
														>{characterKartStat.averagePlacement.toFixed(2)}</Table.Cell
													>
													<Table.Cell class="text-center">{characterKartStat.gpWins}</Table.Cell>
													<Table.Cell class="text-center"
														>{characterKartStat.averageGpPoints.toFixed(0)}</Table.Cell
													>
													<Table.Cell
														>{getTrackName(allTracks, characterKartStat.bestTrack)}</Table.Cell
													>
													<Table.Cell
														>{getTrackName(allTracks, characterKartStat.worstTrack)}</Table.Cell
													>
												</Table.Row>
											{/each}
										{/if}
									{/key}
								</Table.Body>
							</Table.Root>
						</ScrollArea>
					</Card.Content>
				</Card.Root>
				<TrackBars data={trackCounts} />
				<div class="flex flex-col items-center gap-2">
					{#each resultsData.data?.slice(0, 30 * page) as result, i (i)}
						<a href={`/grandprix/${result.grandPrixId}`}>
							<Card.Root>
								<Card.Header>
									<Card.Title class="flex justify-between">
										<div>{getTrackName(allTracks, result.trackEndId)}</div>
										<a href={`/grandprix/${result.grandPrixId}`}>GP {result.grandPrixOrder}</a>
									</Card.Title>
								</Card.Header>
								<Card.Content>
									<div class="flex items-center justify-start gap-4">
										<img
											src={`/tracks/icons/${getTrackImage(allTracks, result.trackEndId)}.png`}
											alt="track"
											class="max-w-16"
										/>
										<div class="h-16">
											<Separator orientation="vertical" />
										</div>
										<img
											src={`/characters/${getCharacterImage(allCharacters, result.characterId)}.png`}
											alt={result.characterId}
											class="max-h-10 max-w-8"
										/>
										<img
											src={`/karts/${getKartImage(allKarts, result.kartId)}.png`}
											alt={result.kartId}
											class="max-h-10 max-w-16"
										/>
										<div class="h-16">
											<Separator orientation="vertical" />
										</div>
										<div
											class="flex w-20 items-center justify-center rounded-sm text-center text-lg text-black"
											style="background-color: {getPositionColour(result.position)}"
										>
											{result.position}
										</div>
									</div>
								</Card.Content>
							</Card.Root>
						</a>
					{/each}
					<div>
						<Button
							variant="outline"
							onclick={() => {
								page = page + 1;
							}}
						>
							Load More
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
