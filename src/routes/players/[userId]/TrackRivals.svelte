<script lang="ts">
	import { resolve } from '$app/paths';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../../convex/_generated/api';
	import type { Id } from '../../../convex/_generated/dataModel';
	import { comparePlayerTracks, formatGap } from './track-rivals';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Table from '$lib/components/ui/table/index.js';
	import SortableHeader from '../../track-stats/SortableHeader.svelte';
	import { average, type TrackSummary } from './player-data';

	let { userId, data }: { userId: Id<'users'>; data: TrackSummary[] } = $props();
	const query = useQuery(api.races.getStats, {});
	const comparisons = $derived(
		comparePlayerTracks(query.data ?? [], userId).map((track) => {
			const summary = data.find((entry) => entry.trackEndId === track.trackId);
			const lastFive = summary?.positions.slice(0, 5) ?? [];
			return { ...track, summary, lastFive, lastFiveAverage: average(lastFive) };
		})
	);
	let filter = $state('raced');
	type SortKey = 'trackName' | 'rank' | 'average' | 'recent' | 'races' | 'lastFive' | 'gap';
	let sort = $state<SortKey>('gap');
	let direction = $state<'asc' | 'desc'>('asc');
	const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
		{ key: 'trackName', label: 'Track' },
		{ key: 'races', label: 'Recorded finishes', numeric: true },
		{ key: 'average', label: 'Avg. finish', numeric: true },
		{ key: 'recent', label: 'Last 10 avg.', numeric: true },
		{ key: 'lastFive', label: 'Last 5', numeric: true },
		{ key: 'rank', label: 'Rank', numeric: true },
		{ key: 'gap', label: 'Gap to lead', numeric: true }
	];
	function toggleSort(key: SortKey) {
		if (sort === key) direction = direction === 'asc' ? 'desc' : 'asc';
		else {
			sort = key;
			direction = 'asc';
		}
	}
	type Comparison = (typeof comparisons)[number];
	function sortValue(track: Comparison, key: SortKey) {
		switch (key) {
			case 'trackName':
				return track.trackName;
			case 'rank':
				return track.rank;
			case 'average':
				return track.player?.average;
			case 'recent':
				return track.summary?.recentAverage;
			case 'races':
				return track.summary?.positions.length;
			case 'lastFive':
				return track.lastFiveAverage;
			case 'gap':
				return track.signedGap;
		}
	}
	const leading = $derived(comparisons.filter((track) => track.status === 'leading').length);
	const close = $derived(
		comparisons.filter((track) => track.status === 'chasing' && track.gap! <= 0.5).length
	);
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
				const left = sortValue(a, sort);
				const right = sortValue(b, sort);
				if (left == null) return right == null ? a.trackName.localeCompare(b.trackName) : 1;
				if (right == null) return -1;
				const comparison =
					typeof left === 'string' && typeof right === 'string'
						? left.localeCompare(right)
						: Number(left) - Number(right);
				return (
					comparison * (direction === 'asc' ? 1 : -1) || a.trackName.localeCompare(b.trackName)
				);
			})
	);
</script>

<section aria-labelledby="rivals-heading">
	<h2 id="rivals-heading" class="font-title text-lg">Track rivals</h2>
	{#if query.error}
		<div role="alert" class="py-8">
			<p>Track comparisons could not be loaded.</p>
			<Button variant="outline" class="mt-3" onclick={query.retry}>Reload comparisons</Button>
		</div>
	{:else if !query.data}
		<p role="status" class="text-muted-foreground py-10">Loading track comparisons…</p>
	{:else}
		<dl class="my-6 grid grid-cols-2 gap-3 border-y py-4">
			{#each [{ label: 'Tracks leading', value: leading }, { label: 'Within 0.50 of lead', value: close }] as stat (stat.label)}
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
					><option value="solo">Only eligible racer</option><option value="low-sample"
						>Below five results</option
					></select
				></label
			>
		</div>
		<div class="bg-card overflow-x-auto rounded-md border">
			<Table.Root class="min-w-[900px]">
				<Table.Header>
					<Table.Row>
						{#each columns as column (column.key)}
							<Table.Head
								class={column.key === 'trackName' ? 'pl-4' : column.numeric ? 'text-right' : ''}
								aria-sort={sort === column.key
									? direction === 'asc'
										? 'ascending'
										: 'descending'
									: 'none'}
							>
								<SortableHeader
									label={column.label}
									sorted={sort === column.key ? direction : false}
									onclick={() => toggleSort(column.key)}
								/>
							</Table.Head>
						{/each}
					</Table.Row>
				</Table.Header>
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
										{#if track.status === 'low-sample'}<span
												class="text-muted-foreground block text-xs"
												>Below five results · unranked</span
											>{/if}
									</div></a
								></Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{track.summary?.positions.length ?? '—'}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{track.player?.average.toFixed(2) ?? '—'}</Table.Cell
							>
							<Table.Cell class="text-right tabular-nums"
								>{track.summary?.recentAverage.toFixed(2) ?? '—'}</Table.Cell
							>
							<Table.Cell>
								<div class="flex justify-end gap-1" aria-label="Last five finishes, newest first">
									{#each track.lastFive as position, i (i)}<PositionBadge
											{position}
											class="size-8"
										/>{:else}<span class="text-muted-foreground">—</span>{/each}
								</div>
							</Table.Cell>
							<Table.Cell class="text-right"><PositionBadge position={track.rank} /></Table.Cell>
							<Table.Cell class="pr-4 text-right tabular-nums">
								{#if track.signedGap != null}
									<span
										class={track.signedGap < 0
											? 'font-medium text-green-700 dark:text-green-400'
											: track.signedGap > 0
												? 'font-medium text-red-700 dark:text-red-400'
												: 'text-muted-foreground'}
										>{track.signedGap < 0 ? '−' : track.signedGap > 0 ? '+' : ''}{formatGap(
											Math.abs(track.signedGap)
										)}</span
									>
								{:else}<span class="text-muted-foreground">—</span>{/if}
							</Table.Cell>
						</Table.Row>
					{:else}<Table.Row
							><Table.Cell colspan={columns.length} class="text-muted-foreground py-10 text-center"
								>No tracks match this view. Choose another filter to compare tracks.</Table.Cell
							></Table.Row
						>{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</section>
