<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { allTracks } from '$lib/stores/states.svelte';
	import type { FunctionReturnType } from 'convex/server';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';
	import { getTrackName } from '$lib/utils';

	let { race } = $props();

	let newTrackId = $state(race.trackStartId);
	let newTrackStartId = $state(race.trackStartId);
	let newTrackEndId = $state(race.trackEndId);
	let isOpen = $state(false);
	const client = useConvexClient();

	let tab = $state('3-laps');

	const updateTrack = async () => {
		if (tab === '3-laps') {
			await client
				.mutation(api.races.updateTrack, {
					raceId: race._id,
					trackStartId: newTrackId,
					trackEndId: newTrackId
				})
				.then((res) => {
					console.log(res);
					isOpen = false;
					return;
				});
		} else {
			await client
				.mutation(api.races.updateTrack, {
					raceId: race._id,
					trackStartId: newTrackStartId,
					trackEndId: newTrackEndId
				})
				.then((res) => {
					console.log(res);
					isOpen = false;
					return;
				});
		}
	};
</script>

{#if allTracks}
	<Dialog.Root bind:open={isOpen}>
		<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Edit Track</Dialog.Trigger>
		<Dialog.Content class="sm:max-w-[425px]">
			<Dialog.Header>
				<Dialog.Title>Edit Track</Dialog.Title>
				<Dialog.Description
					>Update the current track, refresh page to see updates. Maps such as <b>DK Spaceport</b>
					and
					<b>Rainbow Road</b> should not be input as transition maps.</Dialog.Description
				>
			</Dialog.Header>
			<Tabs.Root bind:value={tab}>
				<Tabs.List>
					<Tabs.Trigger value="3-laps">3 Laps</Tabs.Trigger>
					<Tabs.Trigger value="transition">Transition</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="3-laps">
					<Select.Root type="single" bind:value={newTrackId}>
						<Select.Label>Track</Select.Label>
						<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
							{getTrackName(allTracks, newTrackId)}
						</Select.Trigger>
						<Select.Content>
							{#each allTracks as { name, _id } (_id)}
								<Select.Item value={_id}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</Tabs.Content>
				<Tabs.Content value="transition">
					<div class="flex justify-between">
						<div>
							<Select.Root type="single" bind:value={newTrackStartId}>
								<Select.Label>Start Track</Select.Label>
								<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
									{getTrackName(allTracks, newTrackStartId)}
								</Select.Trigger>
								<Select.Content>
									{#each allTracks as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div>
							<Select.Root type="single" bind:value={newTrackEndId}>
								<Select.Label>End Track</Select.Label>
								<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
									{getTrackName(allTracks, newTrackEndId)}
								</Select.Trigger>
								<Select.Content>
									{#each allTracks as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</Tabs.Content>
			</Tabs.Root>

			<Dialog.Footer>
				<Button variant="secondary" onclick={() => updateTrack()}>Save changes</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
