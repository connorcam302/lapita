<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import FlagIcon from '@lucide/svelte/icons/flag';

	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { goto } from '$app/navigation';

	const { playerList } = $props();

	console.log(playerList);

	let userList = $state([]);

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
		userList = playerList.map(({ id }) => id);
	};

	const createGP = async () => {
		const res = await fetch('/api/granprix/new', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ participants: userList })
		});

		if (res.ok) {
			const { id } = await res.json();
			goto(`/granprix/${id}`);
		}
	};
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
			<div class="flex justify-between text-lg font-medium">
				<div>Select users</div>

				<Button variant="outline" class="hover:cursor-pointer" onclick={() => addAllUsers()}>
					<div>Select All</div>
				</Button>
			</div>
			<ScrollArea class="h-96 rounded-xl border">
				<div class="flex flex-col gap-2 pr-2">
					{#each playerList as { id, name }, i (i)}
						{#if userList.includes(id)}
							<Card.Root
								class="border-lapita bg-lapita/10 cursor-pointer"
								onclick={() => handleUserChange(id)}
							>
								<Card.Header>
									<Card.Title>{name}</Card.Title>
								</Card.Header>
							</Card.Root>
						{:else}
							<Card.Root
								class="hover:bg-lapita/10 cursor-pointer"
								onclick={() => handleUserChange(id)}
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
			<Button variant="secondary" type="submit" class="cursor-pointer" onclick={() => createGP()}
				>Start Gran Prix</Button
			>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
