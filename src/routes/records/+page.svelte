<script lang="ts">
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import { resolve } from '$app/paths';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../convex/_generated/api';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Table from '$lib/components/ui/table/index.js';

	const records = useQuery(api.records.get, {});
	let showAll = $state(false);
	const categories = $derived(
		records.data
			? [
					{
						key: 'raceWins',
						title: 'Most race wins',
						description: 'First-place finishes in fully recorded races.',
						unit: 'Wins',
						rows: records.data.raceWins
					},
					{
						key: 'gpWins',
						title: 'Most GP wins',
						description:
							'Overall first places in completed Grand Prix, including manual completion. Ties count for each winner.',
						unit: 'GP wins',
						rows: records.data.gpWins
					},
					{
						key: 'gpScore',
						title: 'Highest GP score',
						description: 'Each player’s best points total in a completed Grand Prix.',
						unit: 'Points',
						rows: records.data.gpScore
					},
					{
						key: 'winStreak',
						title: 'Longest winning streak',
						description:
							'Consecutive first places in race order, across GPs entered. Races with missing finishes break the streak.',
						unit: 'Wins in a row',
						rows: records.data.winStreak
					},
					{
						key: 'podiums',
						title: 'Most podium finishes',
						description: 'Finishes in the top three in fully recorded races.',
						unit: 'Podiums',
						rows: records.data.podiums
					},
					{
						key: 'average',
						title: 'Best average finish',
						description:
							'Lowest average position, with at least 10 fully recorded races. Ranked before rounding.',
						unit: 'Avg. finish',
						rows: records.data.average
					}
				]
			: []
	);
</script>

<svelte:head>
	<title>Records · Lapita</title>
	<meta
		name="description"
		content="All-time Lapita records: race wins, GP victories, best scores, podiums, average finishes and winning streaks."
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="border-b pb-7">
		<h1 class="font-title text-2xl sm:text-3xl">Records</h1>
		{#if records.data}
			<p class="text-muted-foreground mt-4 text-sm tabular-nums">
				{records.data.completedRaces.toLocaleString()} fully recorded races · {records.data.completedGps.toLocaleString()}
				completed Grand Prix
			</p>
		{/if}
	</header>
	<StatisticsHelp scope="records" />

	{#if records.error}
		<section class="py-12" role="alert">
			<h2 class="text-xl font-semibold">Could not load records</h2>
			<p class="text-muted-foreground mt-2">Check your connection and try again.</p>
			<Button variant="outline" class="mt-4" onclick={records.retry}>Try again</Button>
		</section>
	{:else if !records.data}
		<p class="text-muted-foreground py-12" role="status">Loading records…</p>
	{:else if records.data.completedRaces === 0 && records.data.completedGps === 0}
		<section class="py-12">
			<h2 class="font-title text-xl">The records start here</h2>
			<p class="text-muted-foreground mt-3">
				Complete a race with a valid finish for every participant to set the first records.
			</p>
			<Button variant="secondary" class="mt-5" href={resolve('/')}>View Grand Prix</Button>
		</section>
	{:else}
		<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
			<p class="text-muted-foreground text-sm">All-time rankings · Equal values share a place.</p>
			<Button
				variant="outline"
				size="sm"
				onclick={() => (showAll = !showAll)}
				aria-pressed={showAll}>{showAll ? 'Show top five' : 'Show all players'}</Button
			>
		</div>
		<div class="mt-8 grid gap-x-12 gap-y-12 lg:grid-cols-2">
			{#each categories as category (category.key)}
				<section aria-labelledby={`${category.key}-heading`}>
					<h2 id={`${category.key}-heading`} class="font-title text-lg">{category.title}</h2>
					<p class="text-muted-foreground mt-2 min-h-10 max-w-prose text-sm">
						{category.description}
					</p>
					<div class="bg-card mt-4 overflow-x-auto rounded-md border">
						<Table.Root>
							<Table.Header
								><Table.Row
									><Table.Head class="w-14 pl-3">Place</Table.Head><Table.Head>Player</Table.Head
									><Table.Head class="pr-4 text-right">{category.unit}</Table.Head></Table.Row
								></Table.Header
							>
							<Table.Body>
								{#each category.rows.filter((entry) => showAll || entry.rank <= 5) as entry (entry.userId)}
									<Table.Row class={entry.rank === 1 ? 'bg-lapita/10' : ''}>
										<Table.Cell class="pl-3"><PositionBadge position={entry.rank} /></Table.Cell>
										<Table.Cell>
											<a
												class="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
												href={resolve('/players/[userId]', { userId: entry.userId })}
												>{entry.name}</a
											>
											{#if entry.grandPrixId}
												<a
													class="text-muted-foreground focus-visible:ring-ring mt-1 block w-fit rounded-sm text-xs underline-offset-4 hover:underline focus-visible:ring-2"
													href={resolve('/grandprix/[id]', { id: entry.grandPrixId })}
													>Grand Prix {entry.grandPrixOrder} · {entry.raceCount} scheduled races</a
												>
											{:else if category.key === 'average'}<p
													class="text-muted-foreground mt-1 text-xs"
												>
													{entry.raceCount} fully recorded races
												</p>{/if}
										</Table.Cell>
										<Table.Cell class="pr-4 text-right font-medium tabular-nums"
											>{category.key === 'average'
												? entry.value.toFixed(2)
												: entry.value.toLocaleString()}</Table.Cell
										>
									</Table.Row>
								{:else}<Table.Row
										><Table.Cell colspan={3} class="text-muted-foreground px-4 py-8 text-sm"
											>{category.key === 'average'
												? 'No player has completed 10 fully recorded races yet.'
												: category.key === 'gpWins' || category.key === 'gpScore'
													? 'Complete a Grand Prix to set this record.'
													: 'No qualifying finishes yet.'}</Table.Cell
										></Table.Row
									>{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</section>
			{/each}
		</div>
		<p class="text-muted-foreground mt-10 max-w-prose border-t pt-5 text-sm">
			Only races with a valid finish from 1–24 for every participant count. GP records require every
			race to be complete. Scores use Lapita’s points system; best GP totals may cover different
			numbers of races.
		</p>
	{/if}
</main>
