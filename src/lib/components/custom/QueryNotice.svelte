<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	let {
		error = false,
		loading = false,
		label,
		empty = '',
		retry
	}: {
		error?: boolean;
		loading?: boolean;
		label: string;
		empty?: string;
		retry?: () => void;
	} = $props();
</script>

{#if error}
	<div class="bg-card space-y-3 rounded-xl border p-4" role="alert">
		<p class="font-medium">Could not load {label}</p>
		<p class="text-muted-foreground text-sm">Check your connection and try again.</p>
		{#if retry}<Button variant="outline" size="sm" onclick={retry}>Try again</Button>{/if}
	</div>
{:else if loading}
	<p class="text-muted-foreground py-4 text-sm" role="status">Loading {label}…</p>
{:else if empty}
	<p class="text-muted-foreground py-4 text-sm">{empty}</p>
{/if}
