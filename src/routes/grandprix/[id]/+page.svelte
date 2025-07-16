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
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { toast } from 'svelte-sonner';
	import { addNumberSuffix, getPositionColour } from '$lib/utils';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import MoveRight from '@lucide/svelte/icons/move-right';
	import EditTrackButton from '$lib/components/custom/EditTrackButton.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import RaceWinChanceChart from './RaceWinChanceChart.svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	const { data }: { data: PageData } = $props();
	console.log(data);

	let tab = $state('results');

	let { grandPrixDetails, initialRaceResults, userList, characterList, kartList, winChances } =
		data;

	let raceResults = $state(initialRaceResults);
	let selectedCharacterId = $state(page.url.searchParams.get('character') || characterList[0].id);
	let selectedCharacter = $derived(characterList.find((char) => char.id === selectedCharacterId));
	let selectedKartId = $state(page.url.searchParams.get('kart') || kartList[0].id);
	let selectedKart = $derived(kartList.find((kart) => kart.id === selectedKartId));
	let selectedUserId = $state(page.url.searchParams.get('racer') || userList[0].id);
	let selectedUser = $derived(userList.find((racer) => racer.id === Number(selectedUserId)));
	let selectedRaceId = $state(page.url.searchParams.get('track') || raceResults[0].id);
	let selectedRace = $derived(raceResults.find((track) => track.id === Number(selectedRaceId)));
	let selectedRaceWinChance = $derived(
		winChances.find(
			(race) =>
				race.trackId === selectedRace?.trackStartId && race.trackId === selectedRace?.trackEndId
		) ?? undefined
	);

	let selectedRaceAverages = $derived(
		selectedRaceWinChance.data.map((race) => {
			return {
				name: race.user.name,
				average: race.user.average
			};
		})
	);

	let tableColours = $state(page.url.searchParams.get('results-view') || 'medals');

	const getLatestRace = (races: any[]) => {
		for (let i = races.length - 1; i >= 0; i--) {
			const race = races[i];
			if (race.results.slice().some((r) => r.position !== null)) {
				return race;
			}
		}
		return races[0];
	};

	// Remove the redundant $effect block completely
	let latestRace = $derived(getLatestRace(raceResults));
	$effect(() => {
		latestRace = getLatestRace(raceResults);
	});

	let finishPosition = $state('');

	const uploadRaceResults = async () => {
		if (!finishPosition) {
			return toast.error('Missing fields', {
				description: 'Please fill out finish position.'
			});
		}

		const res = await fetch('/api/race/' + selectedRaceId, {
			method: 'POST',
			body: JSON.stringify({
				userId: selectedUserId,
				characterId: selectedCharacterId,
				kartId: selectedKartId,
				position: finishPosition
			})
		});

		if (res.ok) {
			toast.success('Uploaded Result', {
				description: `${selectedUser.name} finished ${addNumberSuffix(finishPosition)} in ${selectedRace?.startTrackName}`
			});
			finishPosition = '';
			subscription.send({
				type: 'broadcast',
				event: 'new-result'
			});
			const currentRaceIndex = raceResults.findIndex((race) => race.id === Number(selectedRaceId));
			selectedRaceId = raceResults[currentRaceIndex + 1].id;
		} else {
			toast.error('Failed to upload result', {
				description: 'Please try again.'
			});
		}
	};

	let subscription;

	const updateResults = async () => {
		await fetch('/api/grandprix/' + grandPrixDetails.id)
			.then((res) => res.json())
			.then((data) => (raceResults = data));
	};

	onMount(async () => {
		subscription = supabase
			.channel('results-update')
			.on(
				'broadcast',
				{
					event: 'new-result'
				},
				(payload) => {
					console.log(payload);
					updateResults();
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
	});

	$effect(() => {
		goto(
			`/grandprix/${grandPrixDetails.id}/?racer=${selectedUserId}&character=${selectedCharacterId}&track=${selectedRaceId}&kart=${selectedKartId}&results-view=${tableColours}`,
			{ noScroll: true }
		);
	});
</script>

<div class="mx-auto flex max-w-4xl flex-col gap-2 px-2 py-8">
	<Card.Root>
		<Card.Header>
			<div class="flex justify-between">
				<div class="flex items-center">
					<Dialog.Root>
						<Dialog.Trigger>
							<img
								src={`/tracks/icons/${selectedRace?.trackStartId}.png`}
								alt={selectedRace?.startTrackName}
								class="h-24 hover:cursor-pointer"
							/>
						</Dialog.Trigger>
						<Dialog.Content class="md:min-w-4xl">
							<Dialog.Title>{selectedRace?.startTrackName}</Dialog.Title>
							<Dialog.Description>
								<img
									src={`/tracks/locations/${selectedRace?.trackStartId}.jpg`}
									alt={selectedRace?.startTrackName}
									class="min-w-full"
								/>
							</Dialog.Description>
						</Dialog.Content>
					</Dialog.Root>
					<div class="flex flex-col gap-1.5">
						<div class="flex items-center gap-2 leading-none font-semibold">
							<div class="text-4xl">{selectedRace?.startTrackName}</div>
							{#if selectedRace?.startTrackName !== selectedRace?.endTrackName}
								<div><MoveRightIcon /></div>
								<div>{selectedRace?.endTrackName}</div>
							{/if}
						</div>
						<div class="text-muted-foreground text-sm">
							Race {selectedRace?.order + 1} of Grand Prix {grandPrixDetails.order}.
						</div>
					</div>
				</div>
				<EditTrackButton originalTrack={selectedRace} />
			</div>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-col gap-2 px-6">
				<div class="flex flex-col gap-1.5">
					<div class="flex items-center gap-2 leading-none font-semibold">Average Placement</div>
					<div class="text-muted-foreground text-sm">
						Average placement to 2 d.p on <b>{selectedRace?.startTrackName}</b>
					</div>
				</div>
				<Table.Root class="table-fixed">
					<Table.Header>
						<Table.Row>
							{#each selectedRaceAverages as { name }, i (i)}
								<Table.Head class="w-16 min-w-16 text-center md:w-full"
									><div class="text-lg">{name}</div></Table.Head
								>
							{/each}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						<Table.Row>
							{#each selectedRaceAverages as { average }, i (i)}
								<Table.Cell
									class="text-center text-lg text-black"
									style="background-color: {getPositionColour(average)}"
									>{average.toFixed(2)}</Table.Cell
								>
							{/each}
						</Table.Row>
					</Table.Body>
				</Table.Root>
			</div>
			<RaceWinChanceChart data={selectedRaceWinChance} />
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
						<Select.Trigger class="w-[100px]">{selectedUser.name}</Select.Trigger>
						<Select.Content class="md:max-w-16">
							{#each userList as { id, name }, i (i)}
								<Select.Item value={id.toString()}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div>
					<Select.Root type="single" bind:value={selectedRaceId}>
						<Select.Label>Race</Select.Label>
						<Select.Trigger class="w-[240px] truncate overflow-hidden text-ellipsis">
							{selectedRace.order + 1}.
							{#if selectedRace.startTrackName === selectedRace.endTrackName}
								{selectedRace.startTrackName}
							{:else}
								{selectedRace.startTrackName}
								<MoveRightIcon />
								{selectedRace.endTrackName}
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each raceResults as { id, startTrackName, endTrackName, order }, i (i)}
								{#if startTrackName === endTrackName}
									<Select.Item value={id.toString()}>{order + 1}. {startTrackName}</Select.Item>
								{:else}
									<Select.Item
										value={id.toString()}
										class="group flex items-center gap-2 text-white hover:text-black"
										>{order + 1}. {startTrackName}
										<MoveRightIcon class="text-white group-data-[highlighted]:text-black" />
										{endTrackName}</Select.Item
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
							{selectedCharacter.name}
						</Select.Trigger>
						<Select.Content>
							{#each characterList as character, i (i)}
								<Select.Item value={character.id}>{character.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div>
					<Select.Root type="single" bind:value={selectedKartId}>
						<Select.Label>Kart</Select.Label>
						<Select.Trigger class="w-[160px]">
							{selectedKart.name}
						</Select.Trigger>
						<Select.Content>
							{#each kartList as kart, i (i)}
								<Select.Item value={kart.id}>{kart.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="flex flex-col">
					<Label class="text-muted-foreground px-2 py-1.5 text-xs">Pos</Label>
					<Input placeholder="##" bind:value={finishPosition} />
				</div>
				<div class="flex w-32 flex-col">
					<Button variant="secondary" class="cursor-pointer" onclick={() => uploadRaceResults()}
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
					{#each latestRace.results
						.slice()
						.sort((a, b) => b.cumulativePoints - a.cumulativePoints) as { id, name, cumulativePoints }, i (i)}
						<div class="flex grow flex-col gap-2">
							<div class="text-sm font-medium">
								{#if i !== 0 && cumulativePoints === latestRace.results
											.slice()
											.sort((a, b) => b.cumulativePoints - a.cumulativePoints)[i - 1].cumulativePoints}
									{Number(i)}. {name}
								{:else}
									{Number(i) + 1}. {name}
								{/if}
							</div>
							<div class="flex items-center justify-between text-lg">
								<div>{cumulativePoints}</div>
								{#if i !== 0}
									<div class="text-sm text-red-500">
										(-{Number(
											latestRace.results
												.slice()
												.sort((a, b) => b.cumulativePoints - a.cumulativePoints)[i - 1]
												.cumulativePoints
										) - cumulativePoints})
									</div>
								{/if}
							</div>
							<Separator />
						</div>
					{/each}
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
			{#if tab === 'cumulative'}
				<ScrollArea class="w-96 md:w-full" orientation="horizontal">
					<Card.Content>
						<Table.Root class="table-fixed">
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-8"><div>#</div></Table.Head>
									<Table.Head class="w-48"><div class="">Race</div></Table.Head>
									{#each userList as { id, name }, i (i)}
										<Table.Head class="w-16 min-w-16 text-center md:w-full"
											><div>{name}</div></Table.Head
										>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each raceResults as { order, startTrackName, endTrackName, id, results }, i (i)}
									<Table.Row>
										<Table.Cell class="">{Number(order) + 1}</Table.Cell>
										{#if startTrackName === endTrackName}
											<Table.Cell
												class="cursor-pointer hover:text-white/60"
												onclick={() => (selectedRaceId = id)}>{startTrackName}</Table.Cell
											>
										{:else}
											<Table.Cell
												class="flex cursor-pointer items-center gap-1.5 hover:text-white/60"
												onclick={() => (selectedRaceId = id)}
											>
												<div><RouteIcon /></div>
												<div class="flex-col items-center justify-center text-xs">
													<div>{startTrackName}</div>
													<div>{endTrackName}</div>
												</div>
											</Table.Cell>
										{/if}

										{#each results as { id, name, position, cumulativePoints }, j (j)}
											{#if position}
												<Table.Cell class="text-center">{cumulativePoints}</Table.Cell>
											{:else}
												<Table.Cell class="text-center"></Table.Cell>
											{/if}
										{/each}
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</Card.Content>
				</ScrollArea>
			{:else if tab === 'results'}
				<ScrollArea class="w-96 md:w-full" orientation="horizontal">
					<Card.Content>
						<Table.Root class="table-fixed">
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-8"><div>#</div></Table.Head>
									<Table.Head class="w-48"><div class="">Race</div></Table.Head>
									{#each userList as { id, name }, i (i)}
										<Table.Head class="w-16 min-w-16 text-center md:w-full"
											><div>{name}</div></Table.Head
										>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each raceResults as { order, startTrackName, endTrackName, id, results }, i (i)}
									<Table.Row>
										<Table.Cell class="">{Number(order) + 1}</Table.Cell>
										{#if startTrackName === endTrackName}
											<Table.Cell
												class="cursor-pointer hover:text-white/60"
												onclick={() => (selectedRaceId = id)}>{startTrackName}</Table.Cell
											>
										{:else}
											<Table.Cell
												class="flex cursor-pointer items-center gap-1.5 hover:text-white/60"
												onclick={() => (selectedRaceId = id)}
											>
												<div><RouteIcon /></div>
												<div class="flex-col items-center justify-center text-xs">
													<div>{startTrackName}</div>
													<div>{endTrackName}</div>
												</div>
											</Table.Cell>
										{/if}

										{#each results as { id, name, position }, j (j)}
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
</div>
