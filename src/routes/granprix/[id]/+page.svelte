<script lang="ts">
	import type { PageData } from './$types';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import Button from '$lib/components/ui/button/button.svelte';

	const { data }: { data: PageData } = $props();

	const { raceList, granPrixDetails, raceResults, userList } = data;

	const allCharacters = ['Mario', 'Luigi', 'Toad'];
	let character = $state(allCharacters[0]);

	let selectedRacerId = $state(userList[0].id);
	let selectedRacer = $derived(userList.find((racer) => racer.id === Number(selectedRacerId)));
	let selectedTrackId = $state(raceList[0].id);
	let selectedTrack = $derived(raceList.find((track) => track.id === Number(selectedTrackId)));
	console.log(data);
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-2 px-2 py-8">
	<Card.Root>
		<Card.Header>
			<Card.Title>Update Results</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex items-end gap-2">
				<div>
					<Select.Root type="single" bind:value={selectedRacerId}>
						<Select.Label>Racer</Select.Label>
						<Select.Trigger class="w-[180px]">{selectedRacer.name}</Select.Trigger>
						<Select.Content>
							{#each userList as { id, name }, i (i)}
								<Select.Item value={id.toString()}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div>
					<Select.Root type="single" bind:value={selectedTrackId}>
						<Select.Label>Track</Select.Label>
						<Select.Trigger class="w-[180px]">
							{selectedTrack.order + 1}. {selectedTrack.name}
						</Select.Trigger>
						<Select.Content>
							{#each raceList as { id, name, order }, i (i)}
								<Select.Item value={id.toString()}>{order + 1}. {name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<Select.Root type="single" bind:value={character}>
						<Select.Label>Character</Select.Label>
						<Select.Trigger class="w-[180px]">
							{character}
						</Select.Trigger>
						<Select.Content>
							{#each allCharacters as character, i (i)}
								<Select.Item value={character}>{character}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="flex flex-col">
					<Label class="text-muted-foreground px-2 py-1.5 text-xs">Pos</Label>
					<Input placeholder="##" />
				</div>
				<div class="flex w-32 flex-col">
					<Button variant="secondary" class="cursor-pointer">Submit</Button>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
	<Card.Root class="max-w-96">
		<Card.Header>
			<Card.Title>Gran Prix {granPrixDetails.order}</Card.Title>
			<Card.Description>Most recent GP Standings</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Caption>Most recent GP Results</Table.Caption>
				<Table.Header>
					<Table.Row>
						<Table.Head><div class="">Order</div></Table.Head>
						<Table.Head><div class="">Track</div></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each raceList as { order, name }, i (i)}
						<Table.Row>
							<Table.Cell class="">{Number(order) + 1}</Table.Cell>
							<Table.Cell class="">{name}</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
