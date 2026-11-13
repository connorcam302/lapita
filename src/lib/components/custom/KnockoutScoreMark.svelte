<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	let { won = false }: { won?: boolean } = $props();
</script>

{#if won}
	<sup class="ml-0.5 inline-flex" title="Won via Knockout Tour"
		><Plus class="size-3" strokeWidth={2.5} aria-hidden="true" /><span class="sr-only">
			(won via Knockout Tour)</span
		></sup
	>
{/if}
