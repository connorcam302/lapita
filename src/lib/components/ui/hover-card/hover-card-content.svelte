<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';

	let {
		ref = $bindable(null),
		class: className,
		side = 'bottom',
		sideOffset = 4,
		align = 'center',
		...restProps
	}: HoverCardPrimitive.ContentProps = $props();
</script>

<HoverCardPrimitive.Portal>
	<HoverCardPrimitive.Content
		bind:ref
		data-slot="hover-card-content"
		{side}
		{sideOffset}
		{align}
		class={cn(
			'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 z-50 w-64 rounded-md border p-4 text-sm shadow-md outline-none motion-reduce:animate-none',
			className
		)}
		{...restProps}
	/>
</HoverCardPrimitive.Portal>
