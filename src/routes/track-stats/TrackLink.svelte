<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Id } from '../../convex/_generated/dataModel';
	let {
		trackId,
		trackImage,
		trackName
	}: { trackId: Id<'tracks'>; trackImage: string; trackName: string } = $props();
</script>

<a
	href={resolve('/tracks/[trackId]', { trackId })}
	class="focus-visible:outline-ring flex items-center gap-3 rounded-sm underline-offset-4 hover:underline focus-visible:outline-2"
>
	<img src={`/tracks/icons/${trackImage}.png`} alt="" class="size-12 shrink-0 object-contain" />
	<span class="font-medium whitespace-normal">{trackName}</span>
</a>
