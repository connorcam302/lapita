<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import { Button } from '$lib/components/ui/button';
	import type { ButtonProps } from '$lib/components/ui/button/button.svelte';

	let {
		label,
		sorted,
		onclick
	}: {
		label: string;
		sorted: false | 'asc' | 'desc';
		onclick: ButtonProps['onclick'];
	} = $props();
</script>

<Button
	variant="ghost"
	size="sm"
	{onclick}
	class="-mx-2 gap-1.5 px-2 text-xs"
	aria-label={`Sort by ${label}`}
>
	{label}
	{#if sorted === 'asc'}
		<ArrowUpIcon class="text-foreground size-3.5" />
	{:else if sorted === 'desc'}
		<ArrowDownIcon class="text-foreground size-3.5" />
	{:else}
		<ArrowUpDownIcon class="text-muted-foreground size-3.5" />
	{/if}
</Button>
