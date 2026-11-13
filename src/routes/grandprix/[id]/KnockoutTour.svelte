<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { summarizeGrandPrix } from '$lib/grand-prix';
	import { api } from '../../../convex/_generated/api';
	import type { Doc, Id } from '../../../convex/_generated/dataModel';

	let {
		grandPrix,
		races,
		players
	}: {
		grandPrix: Doc<'grandPrix'>;
		races: Parameters<typeof summarizeGrandPrix>[1];
		players: Doc<'users'>[];
	} = $props();
	const client = useConvexClient();
	const summary = $derived(
		summarizeGrandPrix(grandPrix.participants, races, grandPrix.completedAt)
	);
	let selected = $state('');
	let position = $state('');
	let saving = $state(false);
	let error = $state('');
	const selectedId = $derived(
		summary.tiedLeaderIds.find((id) => id === selected) ?? summary.tiedLeaderIds[0]
	);
	const name = (id: string) => players.find((player) => player._id === id)?.name ?? 'Unknown racer';

	async function save(userId: Id<'users'>, finish: number | null) {
		if (saving) return;
		saving = true;
		error = '';
		try {
			await client.mutation(api.gps.recordKnockoutResult, {
				grandPrixId: grandPrix._id,
				userId,
				position: finish
			});
			position = '';
			toast.success(
				finish === null ? 'Knockout Tour result removed.' : 'Knockout Tour result saved.'
			);
		} catch (cause) {
			error =
				cause instanceof ConvexError
					? String(cause.data)
					: 'Could not save this result. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

{#if summary.complete && summary.tiedLeaderIds.length === 2}
	<section
		class="bg-card space-y-4 rounded-md border p-4 sm:p-5"
		aria-labelledby="knockout-heading"
		id="knockout-tour"
	>
		<div class="space-y-1">
			<h2 id="knockout-heading" class="font-body text-xl font-semibold">
				Race {races.length + 1} · Knockout Tour
			</h2>
			<p class="text-muted-foreground text-sm">
				Only {summary.tiedLeaderIds.map(name).join(' and ')} can enter this race. The better finish wins
				the GP.
			</p>
		</div>
		<table class="w-full text-sm">
			<caption class="sr-only">Knockout Tour results</caption>
			<thead
				><tr class="border-b"
					><th scope="col" class="py-2 text-left">Racer</th><th scope="col" class="py-2 text-right"
						>Finish</th
					><th scope="col"><span class="sr-only">Actions</span></th></tr
				></thead
			>
			<tbody>
				{#each summary.tiedLeaderIds as userId (userId)}
					{@const result = grandPrix.knockoutResults?.find((result) => result.userId === userId)}
					<tr class="border-b">
						<th scope="row" class="py-3 text-left font-medium"
							>{name(userId)}{grandPrix.knockoutWinnerId === userId ? ' · GP winner' : ''}</th
						>
						<td class="py-3 text-right"
							><span class="inline-flex"><PositionBadge position={result?.position} /></span></td
						>
						<td class="py-3 text-right"
							>{#if result}<Button
									size="sm"
									variant="ghost"
									disabled={saving}
									onclick={() => save(userId, null)}
									aria-label={`Remove ${name(userId)}'s Knockout Tour result`}>Remove</Button
								>{/if}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
		<form
			class="flex flex-wrap items-end gap-3"
			onsubmit={(event) => {
				event.preventDefault();
				if (selectedId && position) void save(selectedId, Number(position));
			}}
		>
			<div class="min-w-36 flex-1 space-y-2">
				<Label for="knockout-racer">Racer</Label>
				<select
					id="knockout-racer"
					value={selectedId}
					onchange={(event) => {
						selected = event.currentTarget.value;
						position = '';
					}}
					disabled={saving}
					class="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
				>
					{#each summary.tiedLeaderIds as userId (userId)}<option value={userId}
							>{name(userId)}</option
						>{/each}
				</select>
			</div>
			<div class="w-24 space-y-2">
				<Label for="knockout-finish">Finish</Label><Input
					id="knockout-finish"
					type="number"
					min="1"
					max="24"
					step="1"
					required
					value={position}
					oninput={(event) => (position = event.currentTarget.value)}
					disabled={saving}
				/>
			</div>
			<Button type="submit" variant="secondary" disabled={saving || !position}
				>{saving ? 'Saving…' : 'Save result'}</Button
			>
		</form>
		{#if error}<p role="alert" class="text-destructive text-sm">{error}</p>{/if}
	</section>
{/if}
