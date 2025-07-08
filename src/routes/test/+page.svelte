<!-- src/routes/+page.svelte (or wherever you want to display your table) -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	let subscription;

	onMount(async () => {
		subscription = supabase
			.channel('table-changes')
			.on(
				'postgres_changes',
				{
					event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
					schema: 'public',
					table: 'grand_prix' // Replace with your actual PostgreSQL table name
				},
				(payload) => {
					console.log('Real-time update:', payload);
					handleRealTimeUpdate(payload);
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		if (subscription) {
			subscription.unsubscribe();
		}
	});
</script>

<div class="table-container">
	<h2>Real-time Table</h2>
</div>
