<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import { PUBLIC_CONVEX_URL } from '$env/static/public';
	import { setupConvex } from 'convex-svelte';

	setupConvex(PUBLIC_CONVEX_URL);
	let { children } = $props();

	import Navbar from '$lib/components/custom/Navbar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
</script>

<ModeWatcher />

<Toaster />
<Navbar />
{@render children?.()}
