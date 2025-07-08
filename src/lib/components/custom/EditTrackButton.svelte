<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { allTracks } from '$lib/data/allTracks';

	let { originalTrack } = $props();

	let newTrack = $state(originalTrack.trackStartId);
	let newStartingTrack = $state(originalTrack.trackStartId);
	let newEndTrack = $state(originalTrack.trackEndId);
	let isOpen = $state(false);

	const getTrackName = (id: string) => {
		return allTracks.find((track) => track.id === id)?.name;
	};

	let tab = $state('3-laps');

	const updateTrack = () => {
		let body;
		if (tab === '3-laps') {
			body = {
				trackStartId: newTrack,
				trackEndId: newTrack
			};
		} else {
			body = {
				trackStartId: newStartingTrack,
				trackEndId: newEndTrack
			};
		}

		fetch(`/api/race/${originalTrack.id}`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		}).then(() => (isOpen = false));
	};
</script>

<Dialog.Root bind:open={isOpen}>
	<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Edit Track</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Edit Track</Dialog.Title>
			<Dialog.Description
				>Update the current track, refresh page to see updates. Maps such as <b>DK Spaceport</b> and
				<b>Rainbow Road</b> should not be input as transition maps.</Dialog.Description
			>
		</Dialog.Header>
		<Tabs.Root bind:value={tab}>
			<Tabs.List>
				<Tabs.Trigger value="3-laps">3 Laps</Tabs.Trigger>
				<Tabs.Trigger value="transition">Transition</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="3-laps">
				<Select.Root type="single" bind:value={newTrack}>
					<Select.Label>Track</Select.Label>
					<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
						{getTrackName(newTrack)}
					</Select.Trigger>
					<Select.Content>
						{#each allTracks as { name, id }, i (i)}
							<Select.Item value={id}>{name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</Tabs.Content>
			<Tabs.Content value="transition">
				<div class="flex justify-between">
					<div>
						<Select.Root type="single" bind:value={newStartingTrack}>
							<Select.Label>Start Track</Select.Label>
							<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
								{getTrackName(newStartingTrack)}
							</Select.Trigger>
							<Select.Content>
								{#each allTracks as { name, id }, i (i)}
									<Select.Item value={id}>{name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div>
						<Select.Root type="single" bind:value={newEndTrack}>
							<Select.Label>End Track</Select.Label>
							<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
								{getTrackName(newEndTrack)}
							</Select.Trigger>
							<Select.Content>
								{#each allTracks as { name, id }, i (i)}
									<Select.Item value={id}>{name}</Select.Item>
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
