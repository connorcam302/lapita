<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Id } from '../../convex/_generated/dataModel';
	let { userId, name }: { userId: Id<'users'> | null; name: string } = $props();
</script>

{#if userId}
	<a
		href={resolve('/players/[userId]', { userId })}
		class="focus-visible:outline-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
		>{name}</a
	>
{:else}—{/if}
