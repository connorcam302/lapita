<script lang="ts">
	import { resolve } from '$app/paths';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import { filterAndSortPlayers, type DirectorySort } from '$lib/player-directory';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import UserRound from '@lucide/svelte/icons/user-round';

	const directory = useQuery(api.users.directory, {});
	let search = $state('');
	let sort = $state<DirectorySort>('name');
	let ascending = $state(true);
	const players = $derived(filterAndSortPlayers(directory.data ?? [], search, sort, ascending));
</script>

<svelte:head>
	<title>Players · Lapita</title>
	<meta
		name="description"
		content="Browse every Lapita player, recorded races, wins and average finishes."
	/>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
		<div>
			<h1 class="font-title text-2xl sm:text-3xl">Players</h1>
			<p class="text-muted-foreground mt-3 text-sm">Find a racer and explore their history.</p>
		</div>
		<Button variant="outline" size="sm" href={resolve('/rivalry')}>Head-to-head comparison</Button>
	</header>

	{#if directory.error}
		<section role="alert" class="py-10">
			<h2 class="text-lg font-semibold">Could not load players</h2>
			<p class="text-muted-foreground mt-2">Check your connection and try again.</p>
			<Button variant="outline" class="mt-4" onclick={directory.retry}>Try again</Button>
		</section>
	{:else if !directory.data}
		<p role="status" class="text-muted-foreground py-10">Loading players…</p>
	{:else if directory.data.length === 0}
		<p role="status" class="text-muted-foreground py-10">
			No players yet. Players will appear here when added to Lapita.
		</p>
	{:else}
		<div class="my-5 flex flex-wrap items-end gap-3">
			<label class="min-w-48 flex-1 text-sm font-medium">
				Search players
				<Input type="search" bind:value={search} placeholder="Player name…" class="mt-2" />
			</label>
			<label class="text-sm font-medium">
				Sort by
				<select
					bind:value={sort}
					onchange={(event) => {
						ascending = ['name', 'averageFinish'].includes(event.currentTarget.value);
					}}
					class="bg-card focus-visible:ring-ring mt-2 block h-9 rounded-md border px-3 text-sm focus-visible:ring-2"
				>
					<option value="name">Name</option>
					<option value="raceCount">Activity (recorded races)</option>
					<option value="raceWins">Race wins</option>
					<option value="gpWins">GP wins</option>
					<option value="averageFinish">Average finish</option>
				</select>
			</label>
			<Button
				variant="outline"
				size="sm"
				class="h-9"
				onclick={() => {
					ascending = !ascending;
				}}
				aria-label={`Sort ${ascending ? 'descending' : 'ascending'}`}
				>{ascending ? 'Ascending' : 'Descending'}</Button
			>
		</div>
		<p role="status" class="text-muted-foreground mb-3 text-sm">
			{players.length} of {directory.data.length} players
		</p>
		<div class="bg-card overflow-hidden rounded-md border">
			<Table.Root>
				<Table.Caption class="sr-only"
					>Player directory, sorted by {sort}
					{ascending ? 'ascending' : 'descending'}</Table.Caption
				>
				<Table.Header
					><Table.Row>
						<Table.Head>Player</Table.Head>
						<Table.Head class="text-right">Recorded races</Table.Head>
						<Table.Head class="text-right">Race wins</Table.Head>
						<Table.Head class="text-right">GP wins</Table.Head>
						<Table.Head class="text-right">Avg. finish</Table.Head>
					</Table.Row></Table.Header
				>
				<Table.Body>
					{#each players as player (player.userId)}
						{@const character = convexStore.allCharacters?.find(
							(entry) => entry._id === player.characterId
						)}
						{@const kart = convexStore.allKarts?.find((entry) => entry._id === player.kartId)}
						<Table.Row>
							<Table.Cell>
								<a
									href={resolve('/players/[userId]', { userId: player.userId })}
									class="focus-visible:outline-ring flex min-w-40 items-center gap-3 rounded-sm py-1 font-medium underline-offset-4 hover:underline focus-visible:outline-2"
								>
									<span class="flex w-20 shrink-0 items-center justify-center gap-1">
										{#if character?.img}<img
												src={`/characters/${character.img}.png`}
												alt={character.name
													? `Most-used character: ${character.name}`
													: 'Most-used character'}
												class="size-10 object-contain"
											/>{:else}<UserRound
												class="text-muted-foreground size-9"
												aria-hidden="true"
											/>{/if}
										{#if kart?.img}<img
												src={`/karts/${kart.img}.png`}
												alt={`Most-used kart: ${kart.name}`}
												class="size-9 object-contain"
											/>{/if}
									</span>
									<span
										>{player.name}{#if player.raceCount === 0}<span
												class="text-muted-foreground block text-xs font-normal"
												>No recorded races</span
											>{/if}</span
									>
								</a>
							</Table.Cell>
							<Table.Cell class="text-right tabular-nums"
								>{player.raceCount.toLocaleString()}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{player.raceWins.toLocaleString()}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{player.gpWins.toLocaleString()}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{player.averageFinish?.toFixed(2) ?? '—'}</Table.Cell
							>
						</Table.Row>
					{:else}
						<Table.Row
							><Table.Cell colspan={5} class="py-8 text-center"
								>No players match “{search.trim()}”.
								<button
									class="focus-visible:outline-ring rounded-sm underline underline-offset-4 focus-visible:outline-2"
									onclick={() => {
										search = '';
									}}>Clear search</button
								></Table.Cell
							></Table.Row
						>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<details class="text-muted-foreground mt-5 text-sm">
			<summary
				class="focus-visible:outline-ring w-fit cursor-pointer rounded-sm font-medium focus-visible:outline-2"
				>How these stats are counted</summary
			>
			<div class="mt-3 max-w-prose space-y-2">
				<p>
					Recorded races count integer finishes from 1–24, including partial races. Race wins count
					1st-place finishes. Average finish uses those same results; lower is better. Activity
					sorts by recorded race count. Deleted GPs are excluded.
				</p>
				<p>
					GP wins use completed GPs, including manually completed GPs. Points come from recorded
					finishes using Lapita scoring; tied leaders each earn a win. Missing finishes earn zero in
					manually completed GPs.
				</p>
				<p>
					Character and kart art show each player’s most-used choices independently across recorded
					finishes. Equal usage is resolved by ID. A dash means no recorded finishes.
				</p>
			</div>
		</details>
	{/if}
</main>
