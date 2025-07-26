<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FlagIcon from '@lucide/svelte/icons/flag';

	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { api } from '../../../convex/_generated/api';
	import { useConvexClient } from 'convex-svelte';
	import { onDestroy } from 'svelte';

	const { playerList } = $props();

	let userList: number[] = $state([]);

	const adduser = (id: number) => {
		userList.push(id);
	};

	const removeuser = (id: number) => {
		userList.splice(userList.indexOf(id), 1);
	};

	const handleUserChange = (id: number) => {
		if (userList.includes(id)) {
			removeuser(id);
		} else {
			adduser(id);
		}
	};

	const addAllUsers = () => {
		userList = playerList.map(({ _id }) => _id);
	};

	const client = useConvexClient();

	let creatingGp = $state(false);

	const createGP = async () => {
		if (userList.length < 4) {
			toast.error('Please select at least 4 users');
			return;
		}
		creatingGp = true;
		const newGpId = await client.mutation(api.gps.newGp, { participants: userList });

		goto(`/grandprix/${newGpId}`);
	};

	onDestroy(() => {
		creatingGp = false;
	});
</script>

<Sheet.Root>
	<Sheet.Trigger>
		<Button variant="secondary" size="xl" class="hover:cursor-pointer">
			<div class="flex items-center gap-2 text-4xl">
				<FlagIcon class="size-9" />
				Start New Grand Prix
			</div>
		</Button>
	</Sheet.Trigger>
	<Sheet.Content>
		<Sheet.Header>
			<Sheet.Title>Start New grand Prix</Sheet.Title>
			<Sheet.Description>
				16 races will be selected from race pool. The pool consists of all races other than <b
					>Rainbow Road</b
				>, which will only be selected for the final race if there is a 5 or less point gap between
				the leader and second place by race 15.
			</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-4 px-4">
			<div class="flex justify-between text-lg font-medium">
				<div>Select users</div>

				<Button variant="outline" class="hover:cursor-pointer" onclick={() => addAllUsers()}>
					<div>Select All</div>
				</Button>
			</div>
			<ScrollArea class="max-h-[600px]">
				<div class="flex flex-col gap-2 pr-2">
					{#each playerList as { _id, name }, i (i)}
						{#if userList.includes(_id)}
							<Card.Root
								class="border-lapita bg-lapita/10 cursor-pointer"
								onclick={() => handleUserChange(_id)}
							>
								<Card.Header>
									<Card.Title>{name}</Card.Title>
								</Card.Header>
							</Card.Root>
						{:else}
							<Card.Root
								class="hover:bg-lapita/10 cursor-pointer"
								onclick={() => handleUserChange(_id)}
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
			<Button
				variant="secondary"
				type="submit"
				class="cursor-pointer"
				onclick={() => createGP()}
				disabled={creatingGp}
			>
				{#if creatingGp}
					<div class="flex items-center gap-2">
						<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
						<div>Starting Grand Prix</div>
					</div>
				{:else}
					Start Grand Prix
				{/if}
			</Button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
