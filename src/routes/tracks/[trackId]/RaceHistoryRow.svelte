<script lang="ts">
	import { resolve } from '$app/paths';
	import HistoryRow from '$lib/components/custom/HistoryRow.svelte';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import { convexStore } from '$lib/stores/states.svelte';
	import { hasAllResults } from '$lib/grand-prix';
	import { validPosition, type TrackRace } from '$lib/track-stats';
	import { placementToPoints } from '$lib/utils';

	let { race }: { race: TrackRace } = $props();
	let expanded = $state(false);
	const resultsId = $props.id();
	const results = $derived(
		[...race.results].sort(
			(a, b) =>
				(validPosition(a.position) ? a.position : 25) -
				(validPosition(b.position) ? b.position : 25)
		)
	);
	const recorded = $derived(results.filter((result) => validPosition(result.position)).length);
	const trackName = (id: string) =>
		convexStore.allTracks?.find((track) => track._id === id)?.name ?? 'Unknown track';
	const points = (position: number | null | undefined) =>
		validPosition(position) ? placementToPoints[position] : null;
</script>

<HistoryRow>
	{#snippet heading()}
		<h3 class="font-body text-xl font-semibold">
			<a
				class="underline-offset-4 hover:underline"
				href={resolve(`/grandprix/[id]?track=${race._id}`, { id: race.grandPrixId })}
				>GP {race.grandPrixOrder ?? '—'} · Race {race.order + 1}</a
			>
		</h3>
		<p class="text-muted-foreground mt-1 text-sm">
			{race.transition
				? `${trackName(race.trackStartId)} → ${trackName(race.trackEndId)}`
				: 'Three-lap race'}
		</p>
	{/snippet}

	<ol
		id={resultsId}
		class="space-y-1.5"
		aria-label={`Results for GP ${race.grandPrixOrder ?? 'unknown'}, race ${race.order + 1}`}
	>
		{#each expanded ? results : results.slice(0, 3) as result, i (result._id)}
			{@const score = points(result.position)}
			{@const aboveScore = i > 0 ? points(results[i - 1].position) : null}
			<li class="flex items-start gap-3 text-sm">
				<PositionBadge position={validPosition(result.position) ? result.position : null} />
				<div class="min-w-0 flex-1 pt-1">
					<a
						class="block truncate underline-offset-4 hover:underline"
						href={resolve('/players/[userId]', { userId: result.userId })}
						>{convexStore.allUsers?.find((player) => player._id === result.userId)?.name ??
							'Unknown player'}</a
					>
					<p class="text-muted-foreground mt-0.5 text-xs">
						{result.characterId
							? (convexStore.allCharacters?.find(
									(character) => character._id === result.characterId
								)?.name ?? 'Unknown character')
							: 'No character'} · {result.kartId
							? (convexStore.allKarts?.find((kart) => kart._id === result.kartId)?.name ??
								'Unknown kart')
							: 'No kart'}
					</p>
				</div>
				<span class="flex shrink-0 items-baseline gap-2 pt-1 tabular-nums">
					{#if score !== null && aboveScore !== null}<span class="text-red-600 dark:text-red-400"
							><span class="sr-only">Points behind racer above: </span>(−{aboveScore - score})</span
						>{/if}
					<span>{score ?? '—'} <span class="text-muted-foreground">pts</span></span>
				</span>
			</li>
		{:else}<li class="text-muted-foreground text-sm">No results yet</li>{/each}
	</ol>
	{#if results.length > 3}
		<button
			type="button"
			class="mt-3 cursor-pointer text-sm underline underline-offset-4"
			aria-expanded={expanded}
			aria-controls={resultsId}
			onclick={() => (expanded = !expanded)}
		>
			{expanded ? 'Show top three' : `Show all ${results.length} results`}
		</button>
	{/if}

	{#snippet status()}
		<p>
			{hasAllResults(race.participants, race.results) ? 'Complete' : 'Awaiting results'}<span
				class="mt-1 block">{recorded}/{race.participants.length} results</span
			>
		</p>
	{/snippet}
</HistoryRow>
