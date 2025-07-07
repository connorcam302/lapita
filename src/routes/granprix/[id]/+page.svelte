<script lang="ts">
	import type { PageData } from './$types';
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
	import { addNumberSuffix } from '$lib/utils';

	const { data }: { data: PageData } = $props();

	let { granPrixDetails, initialRaceResults, userList, characterList } = data;

	let raceResults = $state(initialRaceResults);
	let selectedCharacterId = $state(characterList[0].id);
	let selectedCharacter = $derived(characterList.find((char) => char.id === selectedCharacterId));
	let selectedUserId = $state(userList[0].id);
	let selectedUser = $derived(userList.find((racer) => racer.id === Number(selectedUserId)));
	let selectedRaceId = $state(raceResults[0].id);
	let selectedRace = $derived(raceResults.find((track) => track.id === Number(selectedRaceId)));
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
				position: finishPosition
			})
		});

		if (res.ok) {
			toast.success('Uploaded Result', {
				description: `${selectedUser.name} finished ${addNumberSuffix(finishPosition)} in ${selectedRace.name}`
			});
		} else {
			console.log(res);
			toast.error('Failed to upload result', {
				description: 'Please try again.'
			});
		}
	};

	let subscription;

	const updateResults = async () => {
		await fetch('/api/granprix/' + granPrixDetails.id)
			.then((res) => res.json())
			.then((data) => (raceResults = data));
	};

	onMount(async () => {
		subscription = supabase
			.channel('table-changes')
			.on(
				'postgres_changes',
				{
					event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
					schema: 'public',
					table: 'results' // Replace with your actual PostgreSQL table name
				},
				(payload) => {
					console.log('Real-time update:', payload);
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
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-2 px-2 py-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Update Results</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex items-end gap-2">
				<div>
					<Select.Root type="single" bind:value={selectedUserId}>
						<Select.Label>Racer</Select.Label>
						<Select.Trigger class="w-[180px]">{selectedUser.name}</Select.Trigger>
						<Select.Content>
							{#each userList as { id, name }, i (i)}
								<Select.Item value={id.toString()}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div>
					<Select.Root type="single" bind:value={selectedRaceId}>
						<Select.Label>Race</Select.Label>
						<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
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
						<Select.Trigger class="w-[180px]">
							{selectedCharacter.name}
						</Select.Trigger>
						<Select.Content>
							{#each characterList as character, i (i)}
								<Select.Item value={character.id}>{character.name}</Select.Item>
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
	<Card.Root>
		<Card.Header>
			<Card.Title>Gran Prix {granPrixDetails.order}</Card.Title>
			<Card.Description>Most recent GP Standings</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root class="table-fixed">
				<Table.Caption>Most recent GP Results</Table.Caption>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-8"><div>#</div></Table.Head>
						<Table.Head class="w-48"><div class="">Race</div></Table.Head>
						{#each userList as { id, name }, i (i)}
							<Table.Head class="w-full text-center"><div>{name}</div></Table.Head>
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
								{#if position === 1}
									<Table.Cell class="bg-amber-300/80 text-center text-black">{position}</Table.Cell>
								{:else if position === 2}
									<Table.Cell class="bg-gray-300/80 text-center text-black ">{position}</Table.Cell>
								{:else if position === 3}
									<Table.Cell class="bg-yellow-600/30 text-center ">{position}</Table.Cell>
								{:else}
									<Table.Cell class="text-center">{position}</Table.Cell>
								{/if}
							{/each}
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
