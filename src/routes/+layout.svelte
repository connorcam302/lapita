<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	let { children } = $props();

	import Navbar from '$lib/components/custom/Navbar.svelte';
</script>

<ModeWatcher />

<Navbar />
{@render children?.()}
