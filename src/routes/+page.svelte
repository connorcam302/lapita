<script lang="ts">
	import Leaderboard from '$lib/components/custom/Leaderboard.svelte';
	import StartGPButton from '$lib/components/custom/StartGPButton.svelte';
	import type { PageData } from './$types';
	import Header from './Header.svelte';

	const { data }: { data: PageData } = $props();
	const { leaderboard, playerList } = data;
</script>

<Header />
<div class="mx-auto flex max-w-3xl flex-col items-center gap-2 px-2 py-8">
	<StartGPButton {playerList} />
	<Leaderboard {leaderboard} />
</div>
