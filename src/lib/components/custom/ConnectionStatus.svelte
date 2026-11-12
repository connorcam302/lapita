<script lang="ts">
	import { onMount } from 'svelte';
	import { useConvexClient } from 'convex-svelte';
	const client = useConvexClient();
	let disconnected = $state(false);
	onMount(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const update = () => {
			if (client.connectionState().isWebSocketConnected) {
				clearTimeout(timer);
				timer = undefined;
				disconnected = false;
			} else if (!timer) {
				timer = setTimeout(() => {
					disconnected = true;
				}, 15000);
			}
		};
		update();
		const unsubscribe = client.subscribeToConnectionState(update);
		return () => {
			clearTimeout(timer);
			unsubscribe();
		};
	});
</script>

{#if disconnected}
	<div role="status" class="bg-card mx-auto my-3 max-w-6xl rounded-md border px-4 py-3 text-sm">
		Connection lost. Reconnecting… Available results and your form selections are kept.
	</div>
{/if}
