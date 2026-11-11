<script lang="ts">
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { comparePlayerTracks, formatGap } from './track-rivals';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Table from '$lib/components/ui/table/index.js';

	let { userId, playerName }: { userId: Id<'users'>; playerName: string } = $props();
	const query = useQuery(api.races.getStats, {});
	const comparisons = $derived(comparePlayerTracks(query.data ?? [], userId));
	let filter = $state('raced');
	let sort = $state('gap');
	const leading = $derived(comparisons.filter((track) => track.status === 'leading').length);
	const close = $derived(
		comparisons.filter((track) => track.status === 'chasing' && track.gap! <= 0.5).length
	);
	const unraced = $derived(comparisons.filter((track) => track.status === 'unraced').length);
	const visible = $derived(
		comparisons
			.filter((track) =>
				filter === 'raced'
					? track.status !== 'unraced'
					: filter === 'close'
						? track.status === 'chasing' && track.gap! <= 0.5
						: track.status === filter
			)
			.sort((a, b) => {
				if (sort === 'name') return a.trackName.localeCompare(b.trackName);
				if (sort === 'rank')
					return (
						(a.rank ?? Infinity) - (b.rank ?? Infinity) || a.trackName.localeCompare(b.trackName)
					);
				if (sort === 'average')
					return (
						(a.player?.average ?? Infinity) - (b.player?.average ?? Infinity) ||
						a.trackName.localeCompare(b.trackName)
					);
				return (a.gap ?? Infinity) - (b.gap ?? Infinity) || a.trackName.localeCompare(b.trackName);
			})
	);
	const gapText = (track: (typeof comparisons)[number]) =>
		track.status === 'leading'
			? track.margin === 0
				? 'Joint lead'
				: `Leads by ${formatGap(track.margin!)}`
			: track.status === 'chasing'
				? `${formatGap(track.gap!)} behind`
				: track.status === 'solo'
					? 'Only racer'
					: 'No recorded finish';
</script>

<section aria-labelledby="rivals-heading">
	<h2 id="rivals-heading" class="font-title text-lg">Track rivals</h2>
	<p class="text-muted-foreground mt-2 max-w-2xl text-sm">
		Where {playerName} leads and how much separates them from the best. Compared by all-time average finish,
		just like Track Stats.
	</p>
	{#if query.error}
		<div role="alert" class="py-8">
			<p>Track comparisons could not be loaded.</p>
			<Button variant="outline" class="mt-3" onclick={() => window.location.reload()}
				>Reload comparisons</Button
			>
		</div>
	{:else if !query.data}
		<p role="status" class="text-muted-foreground py-10">Loading track comparisons…</p>
	{:else}
		<dl class="my-6 grid grid-cols-3 gap-3 border-y py-4">
			{#each [{ label: 'Tracks leading', value: leading }, { label: 'Within 0.50 of lead', value: close }, { label: 'Not raced', value: unraced }] as stat (stat.label)}
				<div>
					<dt class="text-muted-foreground text-xs sm:text-sm">{stat.label}</dt>
					<dd class="font-body mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
				</div>
			{/each}
		</dl>
		<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
			<label class="flex items-center gap-2 text-sm"
				>Show<select
					bind:value={filter}
					class="bg-background border-input focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
					><option value="raced">All raced tracks</option><option value="leading">Leading</option
					><option value="close">Within 0.50 of lead</option><option value="chasing"
						>Chasing the lead</option
					><option value="solo">Only racer</option><option value="unraced">Not raced</option
					></select
				></label
			>
			<label class="flex items-center gap-2 text-sm"
				>Sort by<select
					bind:value={sort}
					class="bg-background border-input focus-visible:ring-ring h-9 rounded-md border px-3 focus-visible:ring-2"
					><option value="gap">Closest to lead</option><option value="rank">Rank</option><option
						value="average">Average finish</option
					><option value="name">Track name</option></select
				></label
			>
		</div>
		<div class="overflow-x-auto rounded-md border">
			<Table.Root class="min-w-[700px]">
				<Table.Header
					><Table.Row
						><Table.Head class="pl-4">Track</Table.Head><Table.Head class="text-right"
							>Rank</Table.Head
						><Table.Head class="text-right">Avg. finish</Table.Head><Table.Head
							>Best rival</Table.Head
						><Table.Head class="pr-4">Gap to lead</Table.Head></Table.Row
					></Table.Header
				>
				<Table.Body>
					{#each visible as track (track.trackId)}
						<Table.Row>
							<Table.Cell class="pl-4"
								><a
									href={resolve('/tracks/[trackId]', { trackId: track.trackId })}
									class="focus-visible:ring-ring flex items-center gap-3 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2"
									><img
										src={`/tracks/icons/${track.trackImg}.png`}
										alt=""
										loading="lazy"
										class="size-10 object-contain"
									/>
									<div>
										{track.trackName}
										<p class="text-muted-foreground mt-1 text-xs font-normal sm:hidden">
											{#if track.player}{track.player.average.toFixed(2)} avg. ·
											{/if}{gapText(track)}
										</p>
									</div></a
								></Table.Cell
							>
							<Table.Cell class="text-right"
								><div class="flex items-center justify-end gap-1">
									<PositionBadge position={track.rank} /><span class="text-muted-foreground text-xs"
										>{#if track.rank}
											/ {track.racerCount}{/if}</span
									>
								</div></Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{track.player?.average.toFixed(2) ?? '—'}</Table.Cell
							>

							<Table.Cell
								>{#if track.rival}<a
										href={resolve('/players/[userId]', { userId: track.rival.userId })}
										class="focus-visible:ring-ring rounded-sm underline-offset-4 hover:underline focus-visible:ring-2"
										>{track.rival.userName}</a
									><span class="text-muted-foreground ml-2 text-xs tabular-nums"
										>{track.rival.average.toFixed(2)}</span
									>{:else}<span class="text-muted-foreground">No rival yet</span>{/if}</Table.Cell
							>
							<Table.Cell class="pr-4">
								{#if track.status === 'leading'}
									<span class="font-medium"
										>{track.margin === 0
											? 'Joint lead'
											: `Leads by ${formatGap(track.margin!)}`}</span
									>
								{:else if track.status === 'chasing'}<span class="tabular-nums"
										>{formatGap(track.gap!)} behind</span
									>
								{:else if track.status === 'solo'}<span class="text-muted-foreground"
										>Only racer</span
									>
								{:else}<span class="text-muted-foreground">No recorded finish</span>{/if}
							</Table.Cell>
						</Table.Row>
					{:else}<Table.Row
							><Table.Cell colspan={5} class="text-muted-foreground py-10 text-center"
								>No tracks match this view. Choose another filter to compare tracks.</Table.Cell
							></Table.Row
						>{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<p class="text-muted-foreground mt-4 max-w-3xl text-xs">
			Lower averages are better. Gaps are average finishing positions, not points or a predicted
			number of wins. Leading includes tied first places with another racer; tracks with no rivals
			are listed separately. All recorded numeric finishes count, including transitions grouped by
			the finish track. Sample sizes can differ between racers; there is no minimum race
			requirement. Ranks use unrounded averages.
		</p>
	{/if}
</section>
