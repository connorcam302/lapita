<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import { summarizeTrack, validPosition } from '$lib/track-stats';
	import { hasAllResults } from '$lib/grand-prix';
	import { placementToPoints } from '$lib/utils';
	import RaceHistoryRow from './RaceHistoryRow.svelte';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import Button from '$lib/components/ui/button/button.svelte';

	const detail = useQuery(api.tracks.detail, () => ({ id: page.params.trackId! }));
	const stats = $derived(detail.data ? summarizeTrack(detail.data.races) : null);
	const track = $derived(detail.data?.track);
	let visibleCount = $state(12);
	let historyTrackId = $state<string>();
	$effect(() => {
		if (historyTrackId !== page.params.trackId) {
			historyTrackId = page.params.trackId;
			visibleCount = 12;
		}
	});
	const format = (value: number | null | undefined) => (value == null ? '—' : value.toFixed(2));
	const playerName = (id: string) =>
		convexStore.allUsers?.find((user) => user._id === id)?.name ?? 'Unknown player';
	const characterName = (id: string | undefined) =>
		convexStore.allCharacters?.find((character) => character._id === id)?.name ??
		'Unknown character';
	const kartName = (id: string | undefined) =>
		convexStore.allKarts?.find((kart) => kart._id === id)?.name ?? 'Unknown kart';
</script>

<svelte:head><title>{track?.name ?? 'Track'} · Lapita</title></svelte:head>

<main class="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:py-8">
	<a
		href={resolve('/track-stats')}
		class="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
		>All track stats</a
	>
	{#if detail.error}
		<div role="alert" class="space-y-3 rounded-md border p-6">
			<h1 class="font-title text-xl">Track stats unavailable</h1>
			<p>Couldn’t load this track. Check your connection and try again.</p>
			<Button variant="outline" onclick={() => window.location.reload()}>Try again</Button>
		</div>
	{:else if detail.isLoading}
		<p role="status" class="text-muted-foreground py-12">Loading track stats and race history…</p>
	{:else if !track || !stats || !detail.data}
		<h1 class="font-title text-2xl">Track not found</h1>
		<p class="text-muted-foreground">Choose a track from Track Stats or search.</p>
	{:else}
		<header class="bg-card overflow-hidden rounded-md border">
			<img
				src={`/tracks/locations/${track.img}.jpg`}
				alt={`${track.name} course`}
				class="h-40 w-full object-cover sm:h-56"
			/>
			<div class="space-y-5 p-5 sm:p-6">
				<div class="flex items-center gap-4">
					<img src={`/tracks/icons/${track.img}.png`} alt="" class="size-16 object-contain" />
					<h1 class="font-title text-2xl text-balance sm:text-3xl">{track.name}</h1>
				</div>
				<p class="text-muted-foreground text-sm">
					Races finishing at {track.name}, including transitions. Only recorded positions from 1–24
					contribute to performance stats.
				</p>
				<dl class="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
					{#each [['Races scheduled', detail.data.races.length], ['Races complete', detail.data.races.filter( (race) => hasAllResults(race.participants, race.results) ).length], ['Results recorded', stats.count], ['Avg recorded racers / race', format(stats.averageParticipants)], ['Average position', format(stats.average)], ['Best position', stats.best ?? '—'], ['Wins (1st place)', stats.wins], ['Podiums (top 3)', stats.podiums]] as [label, value] (label)}
						<div>
							<dt class="text-muted-foreground text-sm">{label}</dt>
							<dd class="mt-1 text-xl tabular-nums">{value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</header>

		<Card.Root>
			<Card.Header
				><h2 class="font-title text-lg">Player performance</h2>
				<Card.Description
					>Ranked by average position, lowest first. Recent form uses each player’s last five
					recorded results. Consistency is the standard deviation; lower means more consistent.</Card.Description
				></Card.Header
			>
			<Card.Content>
				{#if !stats.players.length}<p class="text-muted-foreground py-4">
						No results recorded for this track yet.
					</p>{:else}
					<Table.Root>
						<Table.Header
							><Table.Row
								>{#each ['Player', 'Races', 'Average', 'Recent form', 'Best', 'Worst', 'Wins', 'Win rate', 'Podiums', 'Points', 'Consistency'] as label (label)}<Table.Head
										>{label}</Table.Head
									>{/each}</Table.Row
							></Table.Header
						>
						<Table.Body
							>{#each stats.players as player (player.userId)}
								<Table.Row>
									<Table.Cell
										><a
											class="font-medium underline underline-offset-4"
											href={resolve('/players/[userId]', { userId: player.userId })}
											>{playerName(player.userId)}</a
										></Table.Cell
									>
									<Table.Cell>{player.count}</Table.Cell><Table.Cell
										>{format(player.average)}</Table.Cell
									><Table.Cell>{format(player.recentAverage)}</Table.Cell>
									<Table.Cell><PositionBadge position={player.best} /></Table.Cell><Table.Cell
										>{player.worst}</Table.Cell
									><Table.Cell>{player.wins}</Table.Cell><Table.Cell
										>{((100 * player.wins) / player.count).toFixed(1)}%</Table.Cell
									><Table.Cell>{player.podiums}</Table.Cell>
									<Table.Cell
										>{detail.data.races
											.flatMap((race) => race.results)
											.filter(
												(result) =>
													result.userId === player.userId && validPosition(result.position)
											)
											.reduce(
												(sum, result) => sum + placementToPoints[result.position!],
												0
											)}</Table.Cell
									>
									<Table.Cell>{format(player.consistency)}</Table.Cell>
								</Table.Row>
							{/each}</Table.Body
						>
					</Table.Root>{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header
				><h2 class="font-title text-lg">Finishing positions</h2>
				<Card.Description>Distribution of all {stats.count} recorded results.</Card.Description
				></Card.Header
			>
			<Card.Content>
				{#if !stats.count}<p class="text-muted-foreground py-4">
						The distribution will appear once results are recorded.
					</p>{:else}
					<div class="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
						{#each stats.distribution as bucket (bucket.position)}
							<div class="flex items-center gap-2 text-sm">
								<span class="w-6 tabular-nums"
									>{bucket.position}<span class="sr-only"> place</span></span
								>
								<div class="bg-muted h-2 flex-1 overflow-hidden rounded-sm" aria-hidden="true">
									<div
										class="bg-lapita h-full"
										style:width={`${(100 * bucket.count) / Math.max(...stats.distribution.map((item) => item.count))}%`}
									></div>
								</div>
								<span class="w-7 text-right tabular-nums">{bucket.count}</span>
							</div>
						{/each}
					</div>{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header
				><h2 class="font-title text-lg">Character & kart stats</h2>
				<Card.Description
					>Most-used combinations first. Results without both selections are excluded.</Card.Description
				></Card.Header
			>
			<Card.Content>
				{#if !stats.combinations.length}<p class="text-muted-foreground py-4">
						No character and kart combinations recorded yet.
					</p>{:else}
					<Table.Root
						><Table.Header
							><Table.Row
								>{#each ['Character', 'Kart', 'Races', 'Average', 'Best', 'Wins', 'Podiums'] as label (label)}<Table.Head
										>{label}</Table.Head
									>{/each}</Table.Row
							></Table.Header
						>
						<Table.Body
							>{#each stats.combinations as combo (`${combo.characterId}|${combo.kartId}`)}<Table.Row
								>
									<Table.Cell>
										<a
											class="underline underline-offset-4"
											href={resolve(
												`/stats/calculator?character=${combo.characterId}&kart=${combo.kartId}`
											)}>{characterName(combo.characterId)}</a
										></Table.Cell
									><Table.Cell>{kartName(combo.kartId)}</Table.Cell><Table.Cell
										>{combo.count}</Table.Cell
									><Table.Cell>{format(combo.average)}</Table.Cell><Table.Cell
										><PositionBadge position={combo.best} /></Table.Cell
									><Table.Cell>{combo.wins}</Table.Cell><Table.Cell>{combo.podiums}</Table.Cell>
								</Table.Row>{/each}</Table.Body
						>
					</Table.Root>{/if}
			</Card.Content>
		</Card.Root>

		<section aria-labelledby="race-history" class="space-y-4">
			<div>
				<h2 id="race-history" class="font-title text-xl">Race history</h2>
				<p class="text-muted-foreground mt-1 text-sm">
					Newest first. The leading three racers are shown for each race. Show all results to see
					the rest.
				</p>
			</div>
			{#each detail.data.races.slice(0, visibleCount) as race (race._id)}
				<RaceHistoryRow {race} />
			{:else}<p class="text-muted-foreground rounded-md border p-6">
					This track hasn’t appeared in a Grand Prix yet.
				</p>{/each}
			{#if visibleCount < detail.data.races.length}<Button
					variant="outline"
					onclick={() => (visibleCount += 12)}
					>Load more races ({detail.data.races.length - visibleCount} remaining)</Button
				>{/if}
		</section>
	{/if}
</main>
