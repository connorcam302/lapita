<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FlagIcon from '@lucide/svelte/icons/flag';

	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	const { playerList } = $props();

	console.log(playerList);

	const racerList = $state([]);

	const addRacer = (id: number) => {
		racerList.push(id);
	};

	const removeRacer = (id: number) => {
		racerList.splice(racerList.indexOf(id), 1);
	};

	const handleRacerChange = (id: number) => {
		if (racerList.includes(id)) {
			removeRacer(id);
		} else {
			addRacer(id);
		}
		console.log(racerList);
	};

	$effect(() => {
		console.log(racerList);
	});
</script>

<Sheet.Root>
	<Sheet.Trigger>
		<Button variant="secondary" size="xl" class="hover:cursor-pointer">
			<div class="flex items-center gap-2 text-4xl">
				<FlagIcon class="size-9" />
				Start New Gran Prix
			</div>
		</Button>
	</Sheet.Trigger>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Start New Gran Prix</Sheet.Title>
			<Sheet.Description>
				16 races will be selected from race pool. The pool consists of all races other than <b
					>Rainbow Road</b
				>, which will only be selected for the final race if there is a 5 or less point gap between
				the leader and second place by race 15.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-4 px-4">
			<div class="text-lg font-medium">Select Racers</div>
			<ScrollArea class="h-96 rounded-xl border">
				<div class="flex flex-col gap-2 pr-2">
					{#each playerList as { id, name }, i (i)}
						{#if racerList.includes(id)}
							<Card.Root
								class="border-lapita bg-lapita/10 cursor-pointer"
								onclick={() => handleRacerChange(id)}
							>
								<Card.Header>
									<Card.Title>{name}</Card.Title>
								</Card.Header>
							</Card.Root>
						{:else}
							<Card.Root
								class="hover:bg-lapita/10 cursor-pointer"
								onclick={() => handleRacerChange(id)}
							>
								<Card.Header>
									<Card.Title>{name}</Card.Title>
								</Card.Header>
							</Card.Root>
						{/if}
					{/each}
				</div>
			</ScrollArea>
		</div>
		<Sheet.Footer>
			<Button variant="secondary" type="submit" class="cursor-pointer">Start Gran Prix</Button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
