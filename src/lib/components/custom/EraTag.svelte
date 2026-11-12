<script lang="ts">
	import { resolve } from '$app/paths';
	let { era }: { era?: string } = $props();
</script>

{#if era}
	<a
		href={resolve(`/grandprix?era=${encodeURIComponent(era)}`)}
		class="bg-muted text-foreground focus-visible:ring-ring mt-2 inline-block max-w-full rounded-sm px-2 py-1 text-xs break-words underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
		aria-label={`View era: ${era}`}>{era}</a
	>
{/if}
