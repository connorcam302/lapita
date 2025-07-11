<script lang="ts">
	import Leaderboard from '$lib/components/custom/Leaderboard.svelte';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import StartGPButton from '$lib/components/custom/StartGPButton.svelte';
	import type { PageData } from './$types';
	import Header from './Header.svelte';

	const { data }: { data: PageData } = $props();

	let { playerList, allGpResults } = data;
	console.log(data);
</script>

<Header />
<div class="mx-auto flex max-w-3xl flex-col items-center gap-2 px-2 py-8">
	<StartGPButton {playerList} />
	<div class="flex w-full flex-col gap-2">
		{#each allGpResults as gpResult (gpResult.id)}
			<a href="/grandprix/{gpResult.id}">
				<Card.Root class="w-full">
					<Card.Header>
						<Card.Title>Grand Prix {gpResult.order}</Card.Title>
					</Card.Header>
					<Card.Content class="flex gap-4">
						{#each gpResult.standings as standing, i (i)}
							<div class="flex w-28 justify-between">
								<div class="flex flex-col gap-1">
									<div class="text-lg font-medium">{i + 1}. {standing.username}</div>
									<div class="flex items-center gap-4">
										<div>{standing.score}</div>
										{#if i !== 0}
											<div class="text-sm text-red-500">(-{gpResult.standings[i - 1].score})</div>
										{/if}
									</div>
								</div>
								<Separator orientation="vertical" />
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			</a>
		{/each}
	</div>
</div>
