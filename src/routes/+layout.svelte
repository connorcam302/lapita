<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { convexUrl } from '$lib/convex-url';
	import { setupConvex } from 'convex-svelte';

	setupConvex(convexUrl);
	let { children } = $props();

	import { Button } from '$lib/components/ui/button';
	import Navbar from '$lib/components/custom/Navbar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { convexStore } from '$lib/stores/states.svelte';
	import ConnectionStatus from '$lib/components/custom/ConnectionStatus.svelte';
	import QueryNotice from '$lib/components/custom/QueryNotice.svelte';
	import { page } from '$app/state';
</script>

<ModeWatcher />

<Toaster />
<Navbar />
<ConnectionStatus />

<div>
	{#if convexStore.isLoaded || page.error}
		{#if page.error}
			{@render children?.()}
		{:else}
			<div>
				{#if [convexStore.allUsers, convexStore.allTracks, convexStore.allCharacters, convexStore.allKarts].some((list) => list?.length === 0)}
					<div class="bg-card mx-auto my-4 max-w-6xl space-y-3 rounded-md border p-4" role="status">
						<p>
							Some players, tracks or combinations have not been set up yet. Available history is
							still shown.
						</p>
						<Button
							variant="outline"
							size="sm"
							disabled={convexStore.isLoading}
							onclick={() => convexStore.loadData()}
							>{convexStore.isLoading ? 'Checking…' : 'Check again'}</Button
						>
					</div>
				{/if}
				{@render children?.()}
			</div>
		{/if}
	{:else if convexStore.error}
		<main class="mx-auto max-w-xl px-4 py-12">
			<QueryNotice
				error
				label="Lapita’s players, tracks and combinations"
				retry={() => convexStore.loadData()}
			/>
		</main>
	{:else}
		<div class="flex min-h-80 flex-col items-center justify-center gap-4" role="status">
			<img src="/lapita-logo.png" class="w-48 motion-safe:animate-bounce" alt="Lapita" />
			<p class="text-muted-foreground">Loading players, tracks and combinations…</p>
		</div>
	{/if}
</div>
