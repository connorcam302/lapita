<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';

	const deleted = useQuery(api.gps.deleted, {});
	const client = useConvexClient();
	let restoring = $state<Id<'grandPrix'> | null>(null);

	async function restore(grandPrixId: Id<'grandPrix'>) {
		if (restoring) return;
		restoring = grandPrixId;
		try {
			await client.mutation(api.gps.restore, { grandPrixId });
			toast.success('Grand Prix restored with all races and results.');
		} catch {
			toast.error('Could not restore this Grand Prix. Try again.');
		} finally {
			restoring = null;
		}
	}
</script>

<svelte:head>
	<title>Deleted Grand Prix · Lapita</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="mx-auto max-w-4xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<h1 class="font-title text-2xl sm:text-3xl">Deleted Grand Prix</h1>
	<p class="text-muted-foreground mt-3 text-sm">
		Deleted Grand Prix keep their races, results, and standings. Restore one to include it in
		history and statistics again.
	</p>
	{#if deleted.error}
		<p class="mt-4 text-sm" role="alert">
			Could not load deleted Grand Prix. Reload the page to try again.
		</p>
	{:else if !deleted.data}
		<p class="text-muted-foreground mt-4 text-sm" role="status">Loading deleted Grand Prix…</p>
	{:else}
		<ul class="mt-4 divide-y">
			{#each deleted.data as gp (gp._id)}
				<li class="flex flex-wrap items-center justify-between gap-3 py-3">
					<div>
						<p class="font-medium">Grand Prix {gp.order}</p>
						<p class="text-muted-foreground text-sm">
							Deleted {new Date(gp.deletedAt!).toLocaleDateString()}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={restoring !== null}
						onclick={() => restore(gp._id)}
						aria-label={`Restore Grand Prix ${gp.order}`}
					>
						{restoring === gp._id ? 'Restoring…' : 'Restore'}
					</Button>
				</li>
			{:else}
				<li class="text-muted-foreground text-sm">No deleted Grand Prix.</li>
			{/each}
		</ul>
	{/if}
</main>
