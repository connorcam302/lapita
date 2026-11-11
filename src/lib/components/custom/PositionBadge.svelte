<script lang="ts">
	import { cn } from '$lib/utils';

	let { position, class: className }: { position: number | null | undefined; class?: string } =
		$props();
</script>

<span
	class={cn(
		'inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-sm font-medium tabular-nums',
		position === 1
			? 'bg-yellow-400 text-black'
			: position === 2
				? 'bg-gray-300 text-black'
				: position === 3
					? 'bg-yellow-600 text-black'
					: 'text-foreground',
		className
	)}
>
	{#if position}
		{position}<span class="sr-only"> place</span>
	{:else}
		<span aria-hidden="true">—</span><span class="sr-only">No result</span>
	{/if}
</span>
