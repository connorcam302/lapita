<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { api } from '../../../convex/_generated/api';
	import type { Doc, Id } from '../../../convex/_generated/dataModel';
	import { useConvexClient } from 'convex-svelte';

	let { playerList }: { playerList: Doc<'users'>[] } = $props();
	let selected: Id<'users'>[] = $state([]);
	let creatingGp = $state(false);
	const client = useConvexClient();

	async function createGP() {
		if (creatingGp || selected.length < 4) return;
		creatingGp = true;
		try {
			const newGpId = await client.mutation(api.gps.newGp, { participants: selected });
			await goto(resolve('/grandprix/[id]', { id: newGpId }));
		} catch {
			toast.error(
				'Could not start the Grand Prix. Your player selection has been kept. Try again.'
			);
		} finally {
			creatingGp = false;
		}
	}
</script>

<Sheet.Root>
	<Sheet.Trigger
		class={buttonVariants({
			variant: 'secondary',
			size: 'lg',
			class: 'h-11 w-full shadow-none sm:w-auto'
		})}
	>
		Start new Grand Prix
	</Sheet.Trigger>
	<Sheet.Content class="flex max-h-dvh flex-col">
		<Sheet.Header>
			<Sheet.Title>Start new Grand Prix</Sheet.Title>
			<Sheet.Description>
				Choose at least four players. Up to 16 tracks are selected for your Grand Prix, excluding
				Rainbow Road.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex items-center justify-between gap-2 px-4">
			<p class="text-sm" aria-live="polite">{selected.length} players selected</p>
			<Button
				class="shadow-none"
				variant="outline"
				disabled={creatingGp}
				onclick={() => (selected = playerList.map(({ _id }) => _id))}>Select all</Button
			>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-2">
			<div class="flex flex-col gap-2">
				{#each playerList as player (player._id)}
					<label
						class="has-data-[state=checked]:border-lapita has-data-[state=checked]:bg-muted hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border p-4"
					>
						<Checkbox
							class="shadow-none"
							checked={selected.includes(player._id)}
							disabled={creatingGp}
							onCheckedChange={(checked) => {
								selected = checked
									? [...selected, player._id]
									: selected.filter((id) => id !== player._id);
							}}
						/>
						<span class="font-medium">{player.name}</span>
					</label>
				{/each}
			</div>
		</div>
		<Sheet.Footer>
			<Button
				variant="secondary"
				class="shadow-none"
				onclick={createGP}
				disabled={creatingGp || selected.length < 4}
			>
				{creatingGp ? 'Starting Grand Prix…' : 'Start Grand Prix'}
			</Button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
