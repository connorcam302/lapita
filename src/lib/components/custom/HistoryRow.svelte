<script lang="ts">
	import type { Snippet } from 'svelte';
	let { heading, children, status }: { heading: Snippet; children: Snippet; status: Snippet } =
		$props();
</script>

<article class="history-row border-border border-b py-5">
	<div>{@render heading()}</div>
	<div class="results min-w-0">{@render children()}</div>
	<div class="status text-muted-foreground text-sm sm:text-right">{@render status()}</div>
</article>

<style>
	.history-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr);
		gap: 2rem;
	}
	.history-row :global(a:focus-visible),
	.history-row :global(button:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 4px;
	}
	@media (max-width: 639px) {
		.history-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 1rem;
		}
		.results {
			grid-row: 2;
			grid-column: 1 / -1;
		}
		.status {
			grid-column: 2;
			grid-row: 1;
			text-align: right;
		}
	}
</style>
