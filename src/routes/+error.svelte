<script>
	import { page } from '$app/state';
	import Button from '$lib/components/ui/button/button.svelte';
	import { browser } from '$app/environment';
	import HouseIcon from '$lib/components/icon/HouseIcon.svelte';

	function goBack() {
		if (browser) {
			console.log('goingback');
			window.history.back();
		}
	}
</script>

<div class="flex h-full w-full flex-col items-center justify-center gap-8">
	<img src="/lakitu-nuh-uh.gif" />
	<h1 class="text-4xl font-medium">Something went wrong.</h1>
	<div>{page.status} {page.error.message}</div>
	<div>
		<Button variant="outline" class="h-12 w-32 text-2xl" onclick={() => goBack()}>Go Back</Button>
		<a href="/"><Button variant="outline" class="h-12 w-32 text-2xl">Home</Button></a>
	</div>
</div>
