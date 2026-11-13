<script lang="ts">
	import { hasTrackSample } from '$lib/track-ranking';
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import { summarizeTrack, validPosition } from '$lib/track-stats';
	import { hasAllResults } from '$lib/grand-prix';
	import { placementToPoints } from '$lib/utils';
	import RaceHistoryRow from './RaceHistoryRow.svelte';
	import TrackSetup from './TrackSetup.svelte';
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
		<div role="alert" class="space-y-3 rounded-xl border p-6">
			<h1 class="font-title text-xl">Track stats unavailable</h1>
			<p>Couldn’t load this track. Check your connection and try again.</p>
			<Button variant="outline" onclick={detail.retry}>Try again</Button>
		</div>
	{:else if detail.isLoading}
		<p role="status" class="text-muted-foreground py-12">Loading track stats and race history…</p>
	{:else if !track || !stats || !detail.data}
		<h1 class="font-title text-2xl">Track not found</h1>
		<p class="text-muted-foreground">Choose a track from Track Stats or search.</p>
	{:else}
		<header class="bg-card overflow-hidden rounded-xl border">
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
				<dl class="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
					{#each [['Scheduled races', detail.data.races.length], ['Fully recorded races', detail.data.races.filter( (race) => hasAllResults(race.participants, race.results) ).length], ['Recorded finishes', stats.count], ['Avg. finishes / race', format(stats.averageParticipants)], ['Avg. finish', format(stats.average)], ['Best finish', stats.best ?? '—'], ['Wins (1st place)', stats.wins], ['Podiums (top 3)', stats.podiums]] as [label, value] (label)}
						<div>
							<dt class="text-muted-foreground text-sm">{label}</dt>
							<dd class="mt-1 text-xl tabular-nums">{value}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</header>
		<StatisticsHelp scope="track" />
		<TrackSetup trackName={track.name} />

		<Card.Root>
			<Card.Header
				><h2 class="font-title text-lg">Player performance</h2>
				<Card.Description
					>Players with at least five valid finishes rank first by average position; smaller samples
					remain visible below, unranked. Recent form uses each player’s last five recorded results.
					Consistency is the standard deviation; lower means more consistent.</Card.Description
				></Card.Header
			>
			<Card.Content>
				{#if !stats.players.length}<p class="text-muted-foreground py-4">
						No results recorded for this track yet.
					</p>{:else}
					<Table.Root>
						<Table.Header
							><Table.Row
								>{#each ['Player', 'Recorded finishes', 'Avg. finish', 'Last 5 avg.', 'Best', 'Worst', 'Wins', 'Win rate', 'Podiums', 'Points', 'Consistency'] as label (label)}<Table.Head
										>{label}</Table.Head
									>{/each}</Table.Row
							></Table.Header
						>
						<Table.Body
							>{#each [...stats.players].sort((a, b) => Number(hasTrackSample(b.count)) - Number(hasTrackSample(a.count)) || a.average! - b.average!) as player (player.userId)}
								<Table.Row>
									<Table.Cell
										><a
											class="font-medium underline underline-offset-4"
											href={resolve('/players/[userId]', { userId: player.userId })}
											>{playerName(player.userId)}</a
										>{#if !hasTrackSample(player.count)}<span
												class="text-muted-foreground block text-xs"
												>Below five results · unranked</span
											>{/if}</Table.Cell
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
								>{#each ['Character', 'Kart', 'Recorded finishes', 'Avg. finish', 'Best', 'Wins', 'Podiums'] as label (label)}<Table.Head
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
			{:else}<p class="text-muted-foreground rounded-xl border p-6">
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
