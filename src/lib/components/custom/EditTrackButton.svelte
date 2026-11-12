<script lang="ts">
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { convexStore } from '$lib/stores/states.svelte';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';
	import { getTrackName } from '$lib/utils';

	import type { Doc, Id } from '../../../convex/_generated/dataModel';
	import { toast } from 'svelte-sonner';

	let { race }: { race: Pick<Doc<'races'>, '_id' | 'trackStartId' | 'trackEndId'> } = $props();

	let newTrackId = $state<Id<'tracks'>>();
	let newTrackStartId = $state<Id<'tracks'>>();
	let newTrackEndId = $state<Id<'tracks'>>();
	let isOpen = $state(false);
	const client = useConvexClient();

	let tab = $state('3-laps');

	let saving = $state(false);
	$effect(() => {
		// Reinitialize for the selected race only when the dialog is opened.
		if (isOpen) {
			newTrackId = race.trackStartId;
			newTrackStartId = race.trackStartId;
			newTrackEndId = race.trackEndId;
			tab = race.trackStartId === race.trackEndId ? '3-laps' : 'transition';
		}
	});
	const updateTrack = async () => {
		if (saving || !(tab === '3-laps' ? newTrackId : newTrackStartId && newTrackEndId)) return;
		saving = true;
		try {
			await client.mutation(api.races.updateTrack, {
				raceId: race._id,
				trackStartId: tab === '3-laps' ? newTrackId! : newTrackStartId!,
				trackEndId: tab === '3-laps' ? newTrackId! : newTrackEndId!
			});
			isOpen = false;
			toast.success('Track updated');
		} catch {
			toast.error('Could not update the track. Your selections have been kept. Try again.');
		} finally {
			saving = false;
		}
	};
</script>

{#if convexStore.allTracks}
	<Dialog.Root bind:open={isOpen}>
		<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Edit Track</Dialog.Trigger>
		<Dialog.Content
			class="sm:max-w-[425px]"
			showCloseButton={!saving}
			onInteractOutside={(event) => {
				if (saving) event.preventDefault();
			}}
			onEscapeKeydown={(event) => {
				if (saving) event.preventDefault();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Edit Track</Dialog.Title>
				<Dialog.Description
					>Update the current track. Changes appear automatically. Maps such as <b>DK Spaceport</b>
					and
					<b>Rainbow Road</b> should not be input as transition maps.</Dialog.Description
				>
			</Dialog.Header>
			<Tabs.Root bind:value={tab}>
				<Tabs.List>
					<Tabs.Trigger disabled={saving} value="3-laps">3 Laps</Tabs.Trigger>
					<Tabs.Trigger disabled={saving} value="transition">Transition</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="3-laps">
					<Select.Root disabled={saving} type="single" bind:value={newTrackId}>
						<Select.Label>Track</Select.Label>
						<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
							{newTrackId ? getTrackName(convexStore.allTracks, newTrackId) : 'Select track'}
						</Select.Trigger>
						<Select.Content>
							{#each convexStore.allTracks as { name, _id } (_id)}
								<Select.Item value={_id}>{name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</Tabs.Content>
				<Tabs.Content value="transition">
					<div class="flex justify-between">
						<div>
							<Select.Root disabled={saving} type="single" bind:value={newTrackStartId}>
								<Select.Label>Start Track</Select.Label>
								<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
									{newTrackStartId
										? getTrackName(convexStore.allTracks, newTrackStartId)
										: 'Select track'}
								</Select.Trigger>
								<Select.Content>
									{#each convexStore.allTracks as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div>
							<Select.Root disabled={saving} type="single" bind:value={newTrackEndId}>
								<Select.Label>End Track</Select.Label>
								<Select.Trigger class="w-[180px] truncate overflow-hidden text-ellipsis">
									{newTrackEndId
										? getTrackName(convexStore.allTracks, newTrackEndId)
										: 'Select track'}
								</Select.Trigger>
								<Select.Content>
									{#each convexStore.allTracks as { name, _id } (_id)}
										<Select.Item value={_id}>{name}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</Tabs.Content>
			</Tabs.Root>

			<Dialog.Footer>
				<Button variant="secondary" disabled={saving} onclick={updateTrack}
					>{saving ? 'Saving…' : 'Save changes'}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
