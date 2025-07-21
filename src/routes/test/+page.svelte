<script lang="ts">
	import { useQuery } from 'convex-svelte';
	import { api } from '../../convex/_generated/api';

	const gps = useQuery(api.gps.get, {});
</script>

{#if gps.isLoading}
	Loading...
{:else if gps.error}
	failed to load: {gps.error.toString()}
{:else}
	<div class="flex flex-col gap-8">
		{#each gps.data as gp}
			<div>
				<div>GP{gp.order}</div>
				<div>{gp.results.length}</div>
				<div>{gp.results}</div>
			</div>
		{/each}
	</div>
{/if}
