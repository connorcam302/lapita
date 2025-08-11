<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { Button } from '$lib/components/ui/button/index.js';
	import Separator from '$lib/components/ui/separator/separator.svelte';

	let { variant = 'outline', label, ...restProps } = $props();
</script>

<div class="mx-2 flex w-full items-stretch">
	<div class="flex items-center gap-4 py-2">
		<span class="truncate">{label}</span>
	</div>
	<div class="grow" />
	<Button {variant} {...restProps} class="m-2">
		<ArrowUpDownIcon />
	</Button>
	<div class="flex items-center">
		<Separator orientation="vertical" class="h-full" />
	</div>
</div>
