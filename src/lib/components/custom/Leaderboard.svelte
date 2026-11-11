<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	import PodiumIcon from '../icon/PodiumIcon.svelte';
	import PositionBadge from './PositionBadge.svelte';
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
		<Card.Title>Grand Prix {leaderboard.gpId}</Card.Title>
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
						<Table.Cell class="text-center"><PositionBadge {position} /></Table.Cell>
						<Table.Cell>{username}</Table.Cell>
						<Table.Cell class="truncate">{character}</Table.Cell>
						<Table.Cell>{score}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
