<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';

	setupConvex(PUBLIC_CONVEX_URL);
	let { children } = $props();

	import Navbar from '$lib/components/custom/Navbar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { convexStore } from '$lib/stores/states.svelte';
	import { fade } from 'svelte/transition';
	import { cubicIn } from 'svelte/easing';
	import { page } from '$app/state';
</script>

<ModeWatcher />

<Toaster />
<Navbar />

<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
	{#if convexStore.isLoaded || page.error}
		{#if page.error}
			{@render children?.()}
		{:else}
			<div transition:fade|global={{ duration: 500, easing: cubicIn }}>
				{@render children?.()}
			</div>
		{/if}
	{:else}
		<div
			class="flex h-dvh items-center justify-center"
			transition:fade|global={{ duration: 500, easing: cubicIn }}
		>
			<img src="/lapita-logo.png" class="w-48 animate-bounce" alt="lapita-logo" />
		</div>
	{/if}
</div>
