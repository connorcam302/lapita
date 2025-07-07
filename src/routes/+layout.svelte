<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	let { children } = $props();

	import Navbar from '$lib/components/custom/Navbar.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
</script>

<ModeWatcher />

<Toaster />
<Navbar />
{@render children?.()}
