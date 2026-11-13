<script lang="ts">
	import { resolve } from '$app/paths';
	import type { FunctionReturnType } from 'convex/server';
	import type { api } from '../../convex/_generated/api';
	import { convexStore } from '$lib/stores/states.svelte';
	import {
		ownershipShares,
		ownershipGap,
		ownershipSummary,
		trackOwnership
	} from '$lib/track-ownership';
	import { Button } from '$lib/components/ui/button';
	import { TRACK_MIN_RESULTS } from '$lib/track-ranking';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Label } from '$lib/components/ui/label';

	let { data }: { data: FunctionReturnType<typeof api.races.getStats> } = $props();
	let selectedPlayer = $state('');
	const tracks = $derived(trackOwnership(data));
	const shares = $derived(ownershipShares(tracks));
	const players = $derived(
		[...(convexStore.allUsers ?? [])].sort((a, b) => a.name.localeCompare(b.name))
	);
	const visible = $derived(
		tracks.filter(
			(track) => !selectedPlayer || track.leaders.some((player) => player.userId === selectedPlayer)
		)
	);
	const summary = $derived(ownershipSummary(tracks, selectedPlayer || undefined));
	const lowSampleCount = $derived(tracks.filter((track) => track.status === 'low-sample').length);
	const unracedCount = $derived(tracks.filter((track) => track.status === 'unraced').length);
	const statusLabels = {
		outright: 'Outright lead',
		shared: 'Shared lead',
		solo: 'Only eligible player',
		'low-sample': 'Low sample · no eligible player',
		unraced: 'Unraced · no valid results'
	};
	const playerColors = [
		'bg-blue-700 dark:bg-blue-400',
		'bg-rose-700 dark:bg-rose-400',
		'bg-emerald-700 dark:bg-emerald-400',
		'bg-violet-700 dark:bg-violet-400',
		'bg-amber-700 dark:bg-amber-400',
		'bg-cyan-700 dark:bg-cyan-400'
	];
	function color(userId: string) {
		return playerColors[
			Math.max(
				0,
				players.findIndex((player) => player._id === userId)
			) % playerColors.length
		];
	}
</script>

<section aria-label="Track ownership">
	<div class="mb-4 flex flex-wrap items-end gap-4">
		<div class="grid min-w-48 gap-2">
			<Label for="ownership-player">Leading player</Label>
			<select
				id="ownership-player"
				bind:value={selectedPlayer}
				class="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
			>
				<option value="">All players</option>
				{#each players as player (player._id)}<option value={player._id}>{player.name}</option
					>{/each}
			</select>
		</div>
		{#if selectedPlayer}<Button variant="outline" size="sm" onclick={() => (selectedPlayer = '')}
				>Show all tracks</Button
			>{/if}
		<p class="text-muted-foreground pb-2 text-xs">{TRACK_MIN_RESULTS} results minimum</p>
	</div>

	<section aria-labelledby="ownership-share-heading">
		<h2 id="ownership-share-heading" class="text-sm font-medium">Ownership share</h2>
		{#if shares.total}
			<Tooltip.Provider delayDuration={100}>
				<div
					class="mt-2 flex h-10 w-full overflow-hidden rounded-md"
					aria-label="Track ownership shares"
				>
					{#each shares.players as share (share.userId)}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="focus-visible:ring-ring border-background relative h-full min-w-0 cursor-pointer border-r outline-none last:border-r-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset {color(
									share.userId
								)}"
								style={`width: ${(100 * share.weight) / shares.total}%`}
								aria-label={`${share.userName}: ${share.weight.toLocaleString(undefined, { maximumFractionDigits: 2 })} track shares. Filter their tracks.`}
								onclick={() => (selectedPlayer = share.userId)}
							/>
							<Tooltip.Content
								class="bg-popover text-popover-foreground max-h-[50vh] max-w-72 overflow-y-auto border text-left"
								arrowClasses="bg-popover"
							>
								<p class="font-semibold">
									{share.userName} · {share.weight.toLocaleString(undefined, {
										maximumFractionDigits: 2
									})} track shares
								</p>
								<ul class="mt-2 space-y-1">
									{#each share.tracks as track (track.trackId)}<li>
											{track.trackName}{track.shared ? ' (shared)' : ''}
										</li>{/each}
								</ul>
							</Tooltip.Content>
						</Tooltip.Root>
					{/each}
					{#if shares.unclaimed}
						<Tooltip.Root>
							<Tooltip.Trigger
								class="bg-muted focus-visible:ring-ring h-full min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
								style={`width: ${(100 * shares.unclaimed) / shares.total}%`}
								aria-label={`${shares.unclaimed} unclaimed tracks`}
							/>
							<Tooltip.Content
								class="bg-popover text-popover-foreground max-h-[50vh] max-w-72 overflow-y-auto border text-left"
								arrowClasses="bg-popover"
								><p class="font-semibold">Unclaimed · {shares.unclaimed} tracks</p>
								<ul class="mt-2 space-y-1">
									{#each tracks.filter((track) => track.status !== 'outright' && track.status !== 'shared') as track (track.trackId)}<li
										>
											{track.trackName} · {statusLabels[track.status]}
										</li>{/each}
								</ul></Tooltip.Content
							>
						</Tooltip.Root>
					{/if}
				</div>
			</Tooltip.Provider>
			<div class="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
				{#each shares.players as share (share.userId)}
					<details>
						<summary
							class="focus-visible:outline-ring cursor-pointer rounded-sm focus-visible:outline-2"
							><span
								class="mr-1 inline-block size-3 rounded-full {color(share.userId)}"
								aria-hidden="true"
							></span>{share.userName} · {share.weight.toLocaleString(undefined, {
								maximumFractionDigits: 2
							})} shares</summary
						>
						<ul class="mt-2 space-y-1 pl-4">
							{#each share.tracks as track (track.trackId)}<li>
									<a
										class="underline underline-offset-4"
										href={resolve('/tracks/[trackId]', { trackId: track.trackId })}
										>{track.trackName}</a
									>{track.shared ? ' (shared)' : ''}
								</li>{/each}
						</ul>
					</details>
				{/each}
				{#if shares.unclaimed}<p class="text-muted-foreground">
						Unclaimed · {shares.unclaimed} tracks
					</p>{/if}
			</div>
		{:else}<p class="text-muted-foreground mt-4 text-sm">No tracks available yet.</p>{/if}
	</section>

	<p class="text-muted-foreground mt-4 mb-2 text-sm tabular-nums" aria-live="polite">
		<strong class="text-foreground">{summary.outright}</strong> outright ·
		<strong class="text-foreground">{summary.shared}</strong>
		shared · {summary.solo} sole eligible
	</p>

	<p class="text-muted-foreground mb-4 text-sm" role="status">
		Showing {visible.length} of {tracks.length} tracks
	</p>
	<div
		class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
		aria-label="Track ownership grid"
	>
		{#each visible as track (track.trackId)}
			<article class="bg-card flex min-w-0 flex-col rounded-xl border p-4">
				<a
					href={resolve('/tracks/[trackId]', { trackId: track.trackId })}
					class="focus-visible:outline-ring hover:text-primary flex items-center gap-3 rounded-sm focus-visible:outline-2"
				>
					<img
						src="/tracks/icons/{track.trackImg}.png"
						alt=""
						loading="lazy"
						class="size-16 shrink-0 object-contain"
					/>
					<h2 class="text-lg leading-snug font-semibold">{track.trackName}</h2>
				</a>
				<p class="text-muted-foreground mt-4 text-xs font-medium">{statusLabels[track.status]}</p>
				{#if track.leaders.length}
					<ul class="mt-2 space-y-2">
						{#each track.leaders as leader (leader.userId)}
							<li class="flex items-start gap-2">
								<span
									class="mt-1 size-3 shrink-0 rounded-full {color(leader.userId)}"
									aria-hidden="true"
								></span><span class="min-w-0 font-semibold break-words"
									>{leader.userName}
									<span class="text-muted-foreground text-sm font-normal"
										>· {leader.count} results</span
									></span
								>
							</li>
						{/each}
					</ul>
					<p class="mt-3 text-sm tabular-nums">
						<strong class="text-2xl">{track.leaders[0].average.toFixed(2)}</strong> average finish
					</p>
					<p class="text-muted-foreground mt-1 text-sm tabular-nums">
						{track.gap === null
							? 'Gap unavailable · no eligible opponent'
							: `${ownershipGap(track.gap)} gap to next eligible player`}
					</p>
				{:else}
					<p class="mt-2 text-sm">
						{track.status === 'unraced'
							? 'No leader yet. Open the track to explore its race history.'
							: 'No player qualifies. Each player needs at least five valid results to qualify.'}
					</p>
				{/if}
				<div class="text-muted-foreground mt-4 border-t pt-3 text-xs tabular-nums">
					<p>
						{track.eligible.length} eligible players · {track.resultCount} valid results · {track.counts}
						scheduled races
					</p>
					{#if track.belowMinimum.length}
						<details class="mt-2">
							<summary
								class="focus-visible:outline-ring cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:outline-2"
								>{track.belowMinimum.length} players below minimum</summary
							>
							<ul class="mt-2 space-y-1">
								{#each track.belowMinimum as player (player.userId)}<li>
										{player.userName} · {player.count} results · {player.average.toFixed(2)} avg.
									</li>{/each}
							</ul>
						</details>
					{/if}
				</div>
			</article>
		{:else}
			<p class="text-muted-foreground py-8 sm:col-span-2 lg:col-span-3">
				{selectedPlayer
					? 'This player has no eligible leading tracks at this minimum. Choose another player or show all tracks.'
					: 'No tracks available yet.'}
			</p>
		{/each}
	</div>
	<details class="mt-4 text-sm">
		<summary
			class="focus-visible:outline-ring cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:outline-2"
			>How ownership is counted</summary
		>
		<p id="ownership-rules" class="text-muted-foreground mt-3 max-w-3xl text-sm">
			At least {TRACK_MIN_RESULTS} valid results per player on each track. Only integer finishes from
			1–24 count, grouped by end track, including transitions and partial races. Deleted Grand Prix are
			excluded. Players below the minimum remain listed on their track tiles.
		</p>

		<p class="text-muted-foreground mt-2 text-sm">
			Every track has equal weight. Shared tracks split equally between owners. Sole-eligible and
			unqualified tracks are unclaimed.
		</p>
		<p class="text-muted-foreground mt-3 max-w-3xl">
			An outright lead requires at least two eligible players and a single best average. Shared
			leaders have exactly equal unrounded averages. A shared track counts once in the overall total
			and once for each tied player. A sole eligible player is shown separately and earns no
			competitive lead. The player filter shows that player’s eligible leading tracks; it never
			removes opponents from ranking. Gaps compare the two best eligible players, so shared leads
			have a gap of zero. Displayed averages are rounded; ranking is not.
		</p>
		<ul class="mt-3 grid gap-2 sm:grid-cols-2">
			{#each players as player (player._id)}
				{@const total = ownershipSummary(tracks, player._id)}
				<li class="flex items-start gap-2">
					<span class="mt-1 size-3 shrink-0 rounded-full {color(player._id)}" aria-hidden="true"
					></span><span
						>{player.name}: {total.outright} outright · {total.shared} shared · {total.solo} sole eligible</span
					>
				</li>
			{/each}
		</ul>
		<p class="text-muted-foreground mt-2 text-sm">
			Across shown tracks: {lowSampleCount} below the minimum · {unracedCount} without valid results.
		</p>
	</details>
</section>
