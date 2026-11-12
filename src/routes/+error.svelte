<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
</script>

<main class="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-12">
	<h1 class="font-title text-2xl">
		{page.status === 404 ? 'Page not found' : 'Could not load this page'}
	</h1>
	<p class="text-muted-foreground" role="alert">
		{page.status === 404
			? 'This page may have moved or the Grand Prix is unavailable.'
			: 'Check your connection and try again.'}
	</p>
	<div class="flex flex-wrap gap-2">
		<Button variant="outline" onclick={() => window.location.reload()}>Try again</Button>
		<Button variant="outline" href="/">Home</Button>
	</div>
</main>
