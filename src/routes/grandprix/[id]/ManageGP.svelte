<script lang="ts">
	import EraTag from '$lib/components/custom/EraTag.svelte';
	import SetEra from '$lib/components/custom/SetEra.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ConvexError } from 'convex/values';
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { api } from '../../../convex/_generated/api';
	import type { Doc, Id } from '../../../convex/_generated/dataModel';

	let { grandPrix, players }: { grandPrix: Doc<'grandPrix'>; players: Doc<'users'>[] } = $props();
	const client = useConvexClient();
	let completing = $state(false);
	let completeOpen = $state(false);
	let adding = $state(false);
	let deleting = $state(false);
	let addOpen = $state(false);
	let deleteOpen = $state(false);
	let selected: Id<'users'>[] = $state([]);
	const available = $derived(
		players.filter((player) => !grandPrix.participants.includes(player._id))
	);
	const additions = $derived(
		selected.filter((id) => available.some((player) => player._id === id))
	);

	async function addRacers() {
		if (adding || !additions.length) return;
		adding = true;
		try {
			await client.mutation(api.gps.addRacers, { grandPrixId: grandPrix._id, userIds: additions });
			selected = [];
			addOpen = false;
			toast.success('Racers added. You can now record their results for any race.');
		} catch (error) {
			toast.error(
				error instanceof ConvexError
					? String(error.data)
					: 'Could not add racers. Your selection has been kept. Try again.'
			);
		} finally {
			adding = false;
		}
	}

	async function setComplete() {
		if (completing) return;
		completing = true;
		const complete = grandPrix.completedAt === undefined;
		try {
			await client.mutation(api.gps.setComplete, { grandPrixId: grandPrix._id, complete });
			completeOpen = false;
			toast.success(complete ? 'Grand Prix marked complete.' : 'Manual completion removed.');
		} catch (error) {
			toast.error(
				error instanceof ConvexError
					? String(error.data)
					: 'Could not update completion. Try again.'
			);
		} finally {
			completing = false;
		}
	}

	async function deleteGP() {
		if (deleting) return;
		deleting = true;
		try {
			await client.mutation(api.gps.remove, { grandPrixId: grandPrix._id });
		} catch {
			toast.error('Could not delete this Grand Prix. Try again.');
			deleting = false;
			return;
		}
		toast.success('Grand Prix deleted.');
		await goto(resolve('/grandprix'));
	}
</script>

<div class="flex flex-wrap items-center justify-between gap-3 pb-2">
	<div>
		<h1 class="font-title text-xl">Grand Prix {grandPrix.order}</h1>
		<EraTag era={grandPrix.era} />
	</div>
	<div class="flex flex-wrap gap-2">
		<SetEra order={grandPrix.order} era={grandPrix.era} />
		<Sheet.Root bind:open={addOpen}>
			<Sheet.Trigger
				class={buttonVariants({ variant: 'outline', size: 'sm' })}
				disabled={deleting || completing}
			>
				Add racers
			</Sheet.Trigger>
			<Sheet.Content class="flex max-h-dvh flex-col">
				<Sheet.Header>
					<Sheet.Title>Add racers</Sheet.Title>
					<Sheet.Description>
						Racers start on zero points with blank entries for every race. Earlier results can be
						filled in. Races count as complete when every racer has a result.
					</Sheet.Description>
				</Sheet.Header>
				<div class="min-h-0 flex-1 overflow-y-auto px-4 py-2">
					{#if available.length}
						<div class="flex flex-col gap-2">
							{#each available as player (player._id)}
								<label
									class="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border p-4"
								>
									<Checkbox
										checked={selected.includes(player._id)}
										disabled={adding}
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
					{:else}
						<p class="text-muted-foreground text-sm">All racers are already in this Grand Prix.</p>
					{/if}
				</div>
				<Sheet.Footer>
					<p class="text-muted-foreground text-sm" aria-live="polite">
						{additions.length} racers selected
					</p>
					<Button variant="secondary" disabled={adding || !additions.length} onclick={addRacers}>
						{adding ? 'Adding racers…' : 'Add selected racers'}
					</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>
		<Dialog.Root bind:open={completeOpen}>
			<Dialog.Trigger
				class={buttonVariants({ variant: 'outline', size: 'sm' })}
				disabled={adding || deleting || completing}
			>
				{grandPrix.completedAt !== undefined ? 'Undo manual completion' : 'Mark complete'}
			</Dialog.Trigger>
			<Dialog.Content
				showCloseButton={!completing}
				onInteractOutside={(event) => {
					if (completing) event.preventDefault();
				}}
				onEscapeKeydown={(event) => {
					if (completing) event.preventDefault();
				}}
			>
				<Dialog.Header>
					<Dialog.Title
						>{grandPrix.completedAt !== undefined
							? 'Undo manual completion?'
							: `Mark Grand Prix ${grandPrix.order} complete?`}</Dialog.Title
					>
					<Dialog.Description>
						{#if grandPrix.completedAt !== undefined}
							Completion will depend on every racer having a valid finish in every race again.
						{:else}
							End this Grand Prix using recorded points. Missing finishes earn zero points, and tied
							leaders each receive a GP win. Results remain editable. You can undo manual
							completion.
						{/if}
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button variant="outline" disabled={completing} onclick={() => (completeOpen = false)}
						>Cancel</Button
					>
					<Button variant="secondary" disabled={completing} onclick={setComplete}>
						{completing
							? 'Saving…'
							: grandPrix.completedAt !== undefined
								? 'Undo manual completion'
								: 'Mark complete'}
					</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
		<Dialog.Root bind:open={deleteOpen}>
			<Dialog.Trigger
				class={buttonVariants({ variant: 'ghost', size: 'sm' })}
				disabled={adding || deleting || completing}
			>
				Delete GP
			</Dialog.Trigger>
			<Dialog.Content
				showCloseButton={!deleting}
				onInteractOutside={(event) => {
					if (deleting) event.preventDefault();
				}}
				onEscapeKeydown={(event) => {
					if (deleting) event.preventDefault();
				}}
			>
				<Dialog.Header>
					<Dialog.Title>Delete Grand Prix {grandPrix.order}?</Dialog.Title>
					<Dialog.Description>
						This hides the Grand Prix from history and statistics. Its races, results, and standings
						are kept so this Grand Prix can be restored.
					</Dialog.Description>
				</Dialog.Header>
				<Dialog.Footer>
					<Button
						variant="outline"
						disabled={deleting || completing}
						onclick={() => (deleteOpen = false)}>Cancel</Button
					>
					<Button variant="destructive" disabled={deleting || completing} onclick={deleteGP}
						>{deleting ? 'Deleting…' : 'Delete Grand Prix'}</Button
					>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>
	</div>
</div>
