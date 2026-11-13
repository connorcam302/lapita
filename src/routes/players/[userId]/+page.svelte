<script lang="ts">
	import KnockoutScoreMark from '$lib/components/custom/KnockoutScoreMark.svelte';
	import { hasTrackSample } from '$lib/track-ranking';
	import StatisticsHelp from '$lib/components/custom/StatisticsHelp.svelte';
	import { resolve } from '$app/paths';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { convexStore } from '$lib/stores/states.svelte';
	import {
		getCharacterImage,
		getKartImage,
		getCharacterName,
		getKartName,
		getTrackImage,
		getTrackName
	} from '$lib/utils';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../../convex/_generated/api';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import TrackBars from './TrackBars.svelte';
	import PersonalProgress from './PersonalProgress.svelte';
	import TrackRivals from './TrackRivals.svelte';
	import { summarizePlayer } from './player-data';

	let { data } = $props();
	const user = $derived(data.userDetails);
	const resultsQuery = useQuery(api.results.getPlayer, () =>
		user ? { userId: user._id } : 'skip'
	);
	const gpQuery = useQuery(api.gps.getPlayerResults, () => (user ? { userId: user._id } : 'skip'));
	const recordsQuery = useQuery(api.records.get, () => (user ? {} : 'skip'));
	const personalRecords = $derived(
		[
			{
				key: 'gpScore',
				label: 'Best GP score',
				unit: 'pts',
				empty: 'No completed Grand Prix yet.'
			},
			{
				key: 'winStreak',
				label: 'Longest winning streak',
				unit: 'wins in a row',
				empty: 'No winning streak yet.'
			},
			{
				key: 'podiums',
				label: 'Podium finishes',
				unit: 'top-three finishes',
				empty: 'No podium finishes yet.'
			},
			{
				key: 'gpWins',
				label: 'Grand Prix wins',
				unit: 'GP wins',
				empty: 'No completed GP wins yet.'
			}
		].map((record) => ({
			...record,
			entry: recordsQuery.data?.[record.key as 'gpScore' | 'winStreak' | 'podiums' | 'gpWins'].find(
				(entry) => entry.userId === user?._id
			)
		}))
	);
	const characters = $derived(convexStore.allCharacters ?? []);
	const karts = $derived(convexStore.allKarts ?? []);
	const tracks = $derived(convexStore.allTracks ?? []);
	const profile = $derived(summarizePlayer(resultsQuery.data ?? [], gpQuery.data ?? []));
	const standings = $derived([...(gpQuery.data ?? [])].sort((a, b) => b.order - a.order));
	const favourite = $derived(profile.combinations[0]);
	const wins = $derived(profile.finished.filter((result) => result.position === 1).length);
	const gpWins = $derived(
		recordsQuery.data
			? (recordsQuery.data.gpWins.find((entry) => entry.userId === user?._id)?.value ?? 0)
			: '—'
	);
	const eligibleTracks = $derived(
		profile.tracks.filter((track) => hasTrackSample(track.positions.length))
	);
	const highlights = $derived(
		eligibleTracks.length
			? [
					{ label: 'Best average', track: eligibleTracks[0] },
					{ label: 'Toughest track', track: eligibleTracks[eligibleTracks.length - 1] }
				]
			: []
	);
	let activeTab = $state('overview');
	let historyType = $state('gps');
	let historyLimit = $state(20);
	let comboOrder = $state('races');
	const combinations = $derived(
		[...profile.combinations].sort((a, b) =>
			comboOrder === 'average'
				? a.averagePlacement - b.averagePlacement
				: comboOrder === 'wins'
					? b.gpWins - a.gpWins
					: b.raceCount - a.raceCount
		)
	);
	const historyCount = $derived(historyType === 'gps' ? standings.length : profile.finished.length);
	$effect(() => {
		if (!user?._id) return;
		historyLimit = 20;
		activeTab = 'overview';
	});
</script>

<svelte:head>
	<title>{user?.name ?? 'Player'} · Lapita</title>
	<meta
		name="description"
		content={`Race results, favourite combinations and track averages for ${user?.name ?? 'this player'}.`}
	/>
</svelte:head>

<main class="profile mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<a
		href={resolve('/')}
		class="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-6 inline-flex items-center gap-2 rounded-sm text-sm focus-visible:ring-2"
		><ArrowLeft class="size-4" />Grand Prix</a
	>
	{#if !user}
		<h1 class="font-title text-2xl">Player not found</h1>
		<p class="text-muted-foreground mt-3">Choose a player from the home page or search.</p>
	{:else if resultsQuery.error || gpQuery.error}
		<section role="alert" class="py-10">
			<h1 class="font-title text-xl">Could not load {user.name}’s profile</h1>
			<p class="text-muted-foreground mt-3">Check your connection and try again.</p>
			<Button
				variant="outline"
				class="mt-5"
				onclick={() => {
					resultsQuery.retry();
					gpQuery.retry();
				}}>Try again</Button
			>
		</section>
	{:else if resultsQuery.isLoading || gpQuery.isLoading}
		<h1 class="font-title text-3xl">{user.name}</h1>
		<p class="text-muted-foreground py-12" role="status">Loading race record…</p>
	{:else}
		<header class="bg-card overflow-hidden rounded-md border">
			<div class="grid grid-cols-[minmax(0,1fr)_6rem] sm:grid-cols-[1fr_18rem]">
				<div class="p-5 sm:p-8">
					<h1 class="font-title text-3xl sm:text-4xl">{user.name}</h1>
					<Button
						variant="outline"
						size="sm"
						class="mt-4"
						href={resolve('/rivalry') + `?a=${user._id}&scope=all`}>Compare rivalry</Button
					>
					{#if favourite}
						<div class="mt-7">
							<p class="text-muted-foreground text-sm">Most-used combination</p>
							<a
								class="focus-visible:ring-ring mt-1 inline-flex items-center gap-2 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
								href={resolve(
									`/stats/calculator?character=${favourite.characterId}&kart=${favourite.kartId}`
								)}
							>
								{getCharacterName(characters, favourite.characterId)} + {getKartName(
									karts,
									favourite.kartId
								)}<ArrowUpRight class="size-4 shrink-0" />
							</a>
							<p class="text-muted-foreground mt-1 text-sm">
								{favourite.raceCount} finishes · {Math.round(
									(favourite.raceCount / profile.finished.length) * 100
								)}% of recorded finishes
							</p>
						</div>
					{:else}
						<p class="text-muted-foreground mt-7">
							A favourite combination will appear as races are recorded.
						</p>
					{/if}
				</div>
				{#if favourite}
					<div
						class="bg-lapita/15 relative flex items-center justify-center overflow-hidden sm:min-h-60"
						aria-hidden="true"
					>
						<img
							src={`/karts/${getKartImage(karts, favourite.kartId)}.png`}
							alt=""
							class="absolute bottom-12 h-20 w-28 object-contain opacity-60 sm:bottom-6 sm:h-32 sm:w-60"
						/>
						<img
							src={`/characters/${getCharacterImage(characters, favourite.characterId)}.png`}
							alt=""
							class="relative h-28 w-24 object-contain sm:h-48 sm:w-40"
						/>
					</div>
				{/if}
			</div>
			<dl class="bg-muted/40 grid grid-cols-2 border-t sm:grid-cols-4">
				{#each [{ label: 'Recorded finishes', value: profile.finished.length }, { label: 'Average finish', value: profile.average?.toFixed(2) ?? '—' }, { label: 'Race wins', value: wins }, { label: 'GP wins', value: gpWins }] as stat (stat.label)}
					<div class="p-5 sm:px-8">
						<dt class="text-muted-foreground text-sm">{stat.label}</dt>
						<dd class="font-body mt-1 text-3xl font-semibold tabular-nums">{stat.value}</dd>
					</div>
				{/each}
			</dl>
		</header>
		<StatisticsHelp scope="player" />

		{#if !profile.finished.length}
			<section class="py-12">
				<h2 class="font-title text-xl">No race finishes yet</h2>
				<p class="text-muted-foreground mt-3">
					{user.name}’s track averages, combinations and race history will appear after a result is
					recorded.
				</p>
			</section>
		{/if}

		<Tabs.Root bind:value={activeTab} class="mt-8 min-w-0 gap-7">
			<Tabs.List
				class="h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 pb-2"
				aria-label="Player profile sections"
			>
				{#each ['overview', 'tracks', 'combinations', 'history'] as section (section)}
					<Tabs.Trigger
						value={section}
						class="data-[state=active]:bg-lapita dark:data-[state=active]:bg-lapita flex-1 px-2 py-2 text-xs capitalize data-[state=active]:text-black data-[state=active]:shadow-none sm:flex-none sm:px-5 sm:text-sm dark:data-[state=active]:text-black"
						>{section}</Tabs.Trigger
					>
				{/each}
			</Tabs.List>
			<Tabs.Content value="overview" class="min-w-0 space-y-10">
				<PersonalProgress userId={user._id} />
				<section aria-labelledby="personal-records-heading">
					<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
						<h2 id="personal-records-heading" class="font-title text-lg">Personal records</h2>
						<Button variant="ghost" size="sm" href={resolve('/records')}
							>All records<ArrowUpRight /></Button
						>
					</div>
					{#if recordsQuery.error}
						<div role="alert" class="text-muted-foreground py-4 text-sm">
							<p>Personal records could not be loaded. Check your connection and try again.</p>
							<Button variant="outline" size="sm" class="mt-3" onclick={recordsQuery.retry}
								>Try again</Button
							>
						</div>
					{:else if !recordsQuery.data}
						<p role="status" class="text-muted-foreground py-6 text-sm">
							Loading personal records…
						</p>
					{:else}
						<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{#each personalRecords as record (record.key)}
								<div class="bg-card rounded-md border p-4">
									<dt class="text-sm font-medium">{record.label}</dt>
									<dd class="mt-2 flex flex-wrap items-baseline gap-2">
										<span class="font-body text-3xl font-semibold tabular-nums"
											>{record.entry?.value ??
												(record.key === 'gpScore' ? '—' : 0)}<KnockoutScoreMark
												won={record.key === 'gpScore' && record.entry?.wonViaKnockout}
											/></span
										>
										<span class="text-muted-foreground text-xs">{record.unit}</span>
									</dd>
									{#if record.entry}
										<p class="text-muted-foreground mt-2 text-xs">
											Rank {record.entry.rank} overall
										</p>
										{#if record.entry.grandPrixId}
											<a
												href={resolve('/grandprix/[id]', { id: record.entry.grandPrixId })}
												class="focus-visible:ring-ring mt-2 inline-flex items-center gap-1 rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-2"
												>Grand Prix {record.entry.grandPrixOrder}<ArrowUpRight class="size-3" /></a
											>
										{/if}
									{:else}
										<p class="text-muted-foreground mt-2 text-xs">{record.empty}</p>
									{/if}
								</div>
							{/each}
						</dl>
					{/if}
				</section>

				<div class="grid gap-x-9 gap-y-4 lg:grid-cols-2">
					<section
						class="grid min-w-0 gap-4 lg:row-span-2 lg:grid-rows-subgrid"
						aria-labelledby="track-highlights"
					>
						<div class="flex items-center justify-between gap-3">
							<h2 id="track-highlights" class="font-title text-lg">On the track</h2>
							<Button variant="ghost" size="sm" onclick={() => (activeTab = 'tracks')}
								>All tracks<ArrowUpRight /></Button
							>
						</div>
						<div class="grid auto-rows-fr gap-3">
							{#each highlights as { label, track } (label)}
								<a
									href={resolve(`/track-stats?track=${track.trackEndId}`)}
									class="bg-card hover:bg-muted focus-visible:ring-ring flex items-center gap-4 rounded-md border p-4 focus-visible:ring-2"
								>
									<img
										src={`/tracks/icons/${getTrackImage(tracks, track.trackEndId)}.png`}
										alt=""
										class="size-16 object-contain"
									/>
									<div class="min-w-0 flex-1">
										<p class="text-muted-foreground text-xs">{label}</p>
										<h3 class="mt-1 font-medium">{getTrackName(tracks, track.trackEndId)}</h3>
										<p class="text-muted-foreground mt-1 text-xs">
											{track.positions.length} finishes
										</p>
									</div>
									<div class="text-right">
										<p class="font-body text-2xl font-semibold tabular-nums">
											{track.average.toFixed(2)}
										</p>
										<p class="text-muted-foreground text-xs">avg. finish</p>
									</div>
								</a>
							{:else}<p class="text-muted-foreground py-6 text-sm">
									No track has five valid finishes yet.
								</p>{/each}
						</div>
					</section>
					<section
						class="mt-5 grid min-w-0 gap-4 lg:row-span-2 lg:mt-0 lg:grid-rows-subgrid"
						aria-labelledby="recent-gps"
					>
						<div class="flex items-center justify-between gap-3">
							<h2 id="recent-gps" class="font-title text-lg">Recent Grand Prix</h2>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => {
									historyType = 'gps';
									activeTab = 'history';
								}}>All results<ArrowUpRight /></Button
							>
						</div>
						{@render gpTable(4, true)}
					</section>
				</div>
				<section aria-labelledby="race-heading">
					<div class="mb-4 flex items-center justify-between gap-3">
						<h2 id="race-heading" class="font-title text-lg">Latest race results</h2>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => {
								historyType = 'races';
								activeTab = 'history';
							}}>All races<ArrowUpRight /></Button
						>
					</div>
					{@render raceTable(8)}
				</section>
			</Tabs.Content>
			<Tabs.Content value="tracks" class="min-w-0 space-y-10">
				<TrackBars data={profile.tracks} />
				<TrackRivals userId={user._id} data={profile.tracks} />
			</Tabs.Content>
			<Tabs.Content value="combinations" class="min-w-0">
				<section aria-labelledby="combo-heading">
					<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 id="combo-heading" class="font-title text-lg">Character & kart combinations</h2>
						</div>
						<label class="flex items-center gap-2 text-sm"
							>Sort by<select
								bind:value={comboOrder}
								class="bg-background border-input focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
								><option value="races">Most used</option><option value="average"
									>Average finish</option
								><option value="wins">GP wins</option></select
							></label
						>
					</div>
					<div class="bg-card overflow-x-auto rounded-md border">
						<Table.Root class="min-w-[850px]">
							<Table.Header
								><Table.Row
									><Table.Head class="pl-4">Combination</Table.Head><Table.Head class="text-right"
										>Recorded finishes</Table.Head
									><Table.Head class="text-right">Avg. finish</Table.Head><Table.Head
										class="text-right">GP wins</Table.Head
									><Table.Head class="text-right">Avg. GP pts</Table.Head><Table.Head
										>Best track</Table.Head
									><Table.Head>Worst track</Table.Head></Table.Row
								></Table.Header
							>
							<Table.Body>
								{#each combinations as combo (`${combo.characterId}|${combo.kartId}`)}
									<Table.Row>
										<Table.Cell class="pl-4"
											><a
												href={resolve(
													`/stats/calculator?character=${combo.characterId}&kart=${combo.kartId}`
												)}
												class="focus-visible:ring-ring flex items-center gap-3 rounded-sm hover:underline focus-visible:ring-2"
												><img
													src={`/characters/${getCharacterImage(characters, combo.characterId)}.png`}
													alt=""
													loading="lazy"
													class="h-12 w-8 object-contain"
												/><img
													src={`/karts/${getKartImage(karts, combo.kartId)}.png`}
													alt=""
													loading="lazy"
													class="h-10 w-14 object-contain"
												/>
												<div>
													<p class="font-medium">
														{getCharacterName(characters, combo.characterId)}
													</p>
													<p class="text-muted-foreground text-xs">
														{getKartName(karts, combo.kartId)}
													</p>
												</div></a
											></Table.Cell
										>
										<Table.Cell class="text-right tabular-nums">{combo.raceCount}</Table.Cell
										><Table.Cell class="text-right font-medium tabular-nums"
											>{combo.averagePlacement.toFixed(2)}</Table.Cell
										><Table.Cell class="text-right tabular-nums">{combo.gpWins}</Table.Cell
										><Table.Cell class="text-right tabular-nums"
											>{combo.averageGpPoints?.toFixed(0) ?? '—'}</Table.Cell
										><Table.Cell
											>{combo.bestTrack
												? getTrackName(tracks, combo.bestTrack)
												: 'Needs 5 results'}</Table.Cell
										><Table.Cell
											>{combo.worstTrack
												? getTrackName(tracks, combo.worstTrack)
												: 'Needs 5 results'}</Table.Cell
										>
									</Table.Row>
								{:else}<Table.Row
										><Table.Cell colspan={7} class="text-muted-foreground py-10 text-center"
											>No character and kart combinations recorded yet.</Table.Cell
										></Table.Row
									>{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</section>
			</Tabs.Content>
			<Tabs.Content value="history" class="min-w-0">
				<section aria-labelledby="history-heading">
					<div class="mb-5 flex flex-wrap items-end justify-between gap-4">
						<div>
							<h2 id="history-heading" class="font-title text-lg">Race history</h2>
						</div>
						<label class="flex items-center gap-2 text-sm"
							>Show<select
								bind:value={historyType}
								onchange={() => (historyLimit = 20)}
								class="bg-background border-input focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
								><option value="gps">Grand Prix</option><option value="races">Races</option></select
							></label
						>
					</div>
					{#if historyType === 'gps'}{@render gpTable(historyLimit)}
					{:else}{@render raceTable(historyLimit)}{/if}
					<div class="mt-5 flex flex-wrap items-center justify-between gap-4">
						<p class="text-muted-foreground text-sm">
							Showing {Math.min(historyLimit, historyCount)} of {historyCount}
							{historyType === 'gps' ? 'Grand Prix' : 'races'}
						</p>
						{#if historyLimit < historyCount}<Button
								variant="outline"
								onclick={() => (historyLimit += 20)}
								>Load more {historyType === 'gps' ? 'Grand Prix' : 'races'}</Button
							>{/if}
					</div>
				</section>
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</main>

{#snippet gpTable(limit: number, fillHeight = false)}
	<div class="bg-card overflow-x-auto rounded-md border" class:grid={fillHeight}>
		<Table.Root class={fillHeight ? 'h-full' : undefined}>
			<Table.Header
				><Table.Row
					><Table.Head class="pl-4">Grand Prix</Table.Head><Table.Head class="text-right"
						>Place</Table.Head
					><Table.Head class="pr-4 text-right">Points</Table.Head></Table.Row
				></Table.Header
			>
			<Table.Body
				>{#each standings.slice(0, limit) as gp (gp.grandPrixId)}<Table.Row
						><Table.Cell class="pl-4"
							><a
								class="focus-visible:ring-ring rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
								href={resolve('/grandprix/[id]', { id: gp.grandPrixId })}>Grand Prix {gp.order}</a
							></Table.Cell
						><Table.Cell class="text-right"><PositionBadge position={gp.position} /></Table.Cell
						><Table.Cell class="pr-4 text-right tabular-nums"
							>{gp.points ?? '—'}<KnockoutScoreMark won={gp.wonViaKnockout} /></Table.Cell
						></Table.Row
					>{:else}<Table.Row
						><Table.Cell colspan={3} class="text-muted-foreground py-8 text-center"
							>No Grand Prix yet.</Table.Cell
						></Table.Row
					>{/each}</Table.Body
			>
		</Table.Root>
	</div>
{/snippet}

{#snippet raceTable(limit: number)}
	<div class="bg-card overflow-x-auto rounded-md border">
		<Table.Root class="min-w-[580px]">
			<Table.Header
				><Table.Row
					><Table.Head class="pl-4">Track</Table.Head><Table.Head>Grand Prix</Table.Head><Table.Head
						>Combination</Table.Head
					><Table.Head class="pr-4 text-right">Finish</Table.Head></Table.Row
				></Table.Header
			>
			<Table.Body>
				{#each profile.finished.slice(0, limit) as result (result._id)}
					<Table.Row
						><Table.Cell class="pl-4"
							><a
								href={resolve(`/grandprix/[id]?track=${result.raceId}`, { id: result.grandPrixId })}
								class="focus-visible:ring-ring flex items-center gap-3 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
								><img
									src={`/tracks/icons/${getTrackImage(tracks, result.trackEndId)}.png`}
									alt=""
									loading="lazy"
									class="size-10 object-contain"
								/>{getTrackName(tracks, result.trackEndId)}</a
							></Table.Cell
						><Table.Cell
							><a
								href={resolve('/grandprix/[id]', { id: result.grandPrixId })}
								class="rounded-sm hover:underline focus-visible:ring-2"
								>GP {result.grandPrixOrder}</a
							></Table.Cell
						><Table.Cell
							><div class="flex items-center gap-2">
								{#if result.characterId}<img
										src={`/characters/${getCharacterImage(characters, result.characterId)}.png`}
										alt={getCharacterName(characters, result.characterId)}
										title={getCharacterName(characters, result.characterId)}
										loading="lazy"
										class="h-10 w-8 object-contain"
									/>{/if}{#if result.kartId}<img
										src={`/karts/${getKartImage(karts, result.kartId)}.png`}
										alt={getKartName(karts, result.kartId)}
										title={getKartName(karts, result.kartId)}
										loading="lazy"
										class="h-10 w-14 object-contain"
									/>{/if}{#if !result.characterId && !result.kartId}<span
										class="text-muted-foreground">Not recorded</span
									>{/if}
							</div></Table.Cell
						><Table.Cell class="pr-4 text-right"
							><PositionBadge position={result.position} /></Table.Cell
						></Table.Row
					>
				{:else}<Table.Row
						><Table.Cell colspan={4} class="text-muted-foreground py-10 text-center"
							>No race finishes recorded yet.</Table.Cell
						></Table.Row
					>{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/snippet}
