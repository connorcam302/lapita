<script lang="ts">
	import { getPositionColour } from '$lib/utils';
	let { value }: { value: number | null } = $props();
</script>

{#if value !== null}
	<span
		class="inline-flex min-w-14 items-center justify-center rounded-sm px-2 py-1 font-medium text-black tabular-nums"
		style:background-color={getPositionColour(value)}>{value.toFixed(2)}</span
	>
{:else}<span class="text-muted-foreground">—</span>{/if}
