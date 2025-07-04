<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import PodiumIcon from '../icon/PodiumIcon.svelte';
	import FirstMedalIcon from '../icon/FirstMedalIcon.svelte';
	import SecondMedalIcon from '../icon/SecondMedalIcon.svelte';
	import ThirdMedalIcon from '../icon/ThirdMedalIcon.svelte';
	let {
		leaderboard
	}: {
		leaderboard: {
			gpId: number;
			standings: {
				userId: number;
				username: string;
				position: number;
				character: string;
				score: number;
			}[];
		};
	} = $props();
</script>

<Card.Root class="max-w-96">
	<Card.Header>
		<Card.Title>Gran Prix {leaderboard.gpId}</Card.Title>
		<Card.Description>Most recent GP Standings</Card.Description>
	</Card.Header>
	<Card.Content>
		<Table.Root>
			<Table.Caption>Most recent GP Results</Table.Caption>
			<Table.Header>
				<Table.Row>
					<Table.Head><div class="flex w-12 items-center gap-2"><PodiumIcon /> Pos</div></Table.Head
					>
					<Table.Head><div class="flex items-center gap-2">Racer</div></Table.Head>
					<Table.Head><div class="flex items-center gap-2">Character</div></Table.Head>
					<Table.Head class="text-right"
						><div class="flex items-center gap-2">Score</div></Table.Head
					>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each leaderboard.standings as { username, position, character, score }, i (i)}
					<Table.Row>
						{#if position === 1}
							<Table.Cell class="flex justify-center text-center text-lg text-amber-300"
								><FirstMedalIcon /></Table.Cell
							>
						{:else if position === 2}
							<Table.Cell class="flex justify-center text-center text-lg text-gray-300"
								><SecondMedalIcon /></Table.Cell
							>
						{:else if position === 3}
							<Table.Cell class="flex justify-center text-lg text-yellow-700"
								><ThirdMedalIcon /></Table.Cell
							>
						{:else}
							<Table.Cell class="flex justify-center font-medium">{position}</Table.Cell>
						{/if}
						<Table.Cell>{username}</Table.Cell>
						<Table.Cell class="truncate">{character}</Table.Cell>
						<Table.Cell>{score}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
