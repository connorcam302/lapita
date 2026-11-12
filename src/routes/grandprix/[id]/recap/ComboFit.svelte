<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import { comboRatingSource, type GpComboFit } from '$lib/gp-combo-fit';
	let { ratings, name }: { ratings: GpComboFit; name: (id: string) => string } = $props();
	const sorted = $derived(
		[...ratings].sort(
			(a, b) => (b.score ?? -1) - (a.score ?? -1) || name(a.userId).localeCompare(name(b.userId))
		)
	);
</script>

<section class="mt-8" aria-labelledby="combo-fit-heading">
	<h2 id="combo-fit-heading" class="font-body text-2xl font-semibold">Combo ratings</h2>
	<p class="text-muted-foreground mt-2 max-w-prose text-sm">
		Ratings for each racer’s recorded choices and track surfaces.
	</p>
	<div class="bg-card mt-4 overflow-x-auto rounded-md border">
		<Table.Root>
			<Table.Caption class="sr-only"
				>Combined rating, sorted highest first. A rating out of 100 is not a win probability.</Table.Caption
			>
			<Table.Header
				><Table.Row>
					<Table.Head>Racer</Table.Head><Table.Head class="text-right">Kart /100</Table.Head>
					<Table.Head class="text-right">Character /100</Table.Head><Table.Head class="text-right"
						>Combined /100</Table.Head
					>
				</Table.Row></Table.Header
			>
			<Table.Body
				>{#each sorted as racer (racer.userId)}<Table.Row>
						<Table.Cell class="font-medium">{name(racer.userId)}</Table.Cell>
						<Table.Cell class="text-right tabular-nums"
							>{racer.kartScore?.toFixed(1) ?? '—'}</Table.Cell
						>
						<Table.Cell class="text-right tabular-nums"
							>{racer.characterScore?.toFixed(1) ?? '—'}</Table.Cell
						>
						<Table.Cell class="text-right font-semibold tabular-nums"
							>{racer.score?.toFixed(1) ?? '—'}</Table.Cell
						>
					</Table.Row>{/each}</Table.Body
			>
		</Table.Root>
	</div>
	<div class="mt-5 space-y-3">
		{#each ratings as racer (racer.userId)}
			<details class="bg-card rounded-md border p-4">
				<summary
					class="focus-visible:ring-ring cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2"
					>{name(racer.userId)} · race ratings</summary
				>
				<div class="mt-4 overflow-x-auto">
					<Table.Root class="min-w-[650px]"
						><Table.Header
							><Table.Row
								><Table.Head>Race</Table.Head><Table.Head>Track</Table.Head><Table.Head
									>Character / kart</Table.Head
								><Table.Head class="text-right">Kart /100</Table.Head><Table.Head class="text-right"
									>Character /100</Table.Head
								><Table.Head class="text-right">Combined /100</Table.Head><Table.Head
									>Coverage / status</Table.Head
								></Table.Row
							></Table.Header
						><Table.Body>
							{#each racer.rows as row (row.raceId)}<Table.Row
									><Table.Cell class="tabular-nums">{row.order + 1}</Table.Cell><Table.Cell
										>{row.transition
											? `${row.startTrackName} → ${row.trackName}`
											: row.trackName}</Table.Cell
									><Table.Cell>{row.characterName ?? '—'} / {row.kartName ?? '—'}</Table.Cell
									><Table.Cell class="text-right tabular-nums"
										>{row.kartScore?.toFixed(1) ?? '—'}</Table.Cell
									><Table.Cell class="text-right tabular-nums"
										>{row.characterScore?.toFixed(1) ?? '—'}</Table.Cell
									><Table.Cell class="text-right tabular-nums"
										>{row.score?.toFixed(1) ?? '—'}</Table.Cell
									><Table.Cell class="text-xs"
										>{row.reason ??
											(row.coverage
												? `Road ${row.coverage.road}% · Rough ${row.coverage.rough}% · Water ${row.coverage.water}% · Gliding ${row.coverage.gliding}% · Neutral ${row.coverage.neutral}%`
												: 'No coverage')}</Table.Cell
									></Table.Row
								>{/each}
						</Table.Body></Table.Root
					>
				</div>
			</details>
		{/each}
	</div>
	<details class="text-muted-foreground mt-4 max-w-prose text-sm">
		<summary
			class="focus-visible:ring-ring w-fit cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2"
			>How combo fit is calculated</summary
		>
		<div class="mt-3 space-y-3 text-xs">
			<p>
				The Mario Kart World Statpedia’s Total 1 model, using each track’s surfaces. Includes speed
				and coin curve, handling, acceleration, mini-turbo, weight and invincibility. Scores are
				relative to the catalogue (0–100), not win probabilities.
			</p>
			<p>
				Character and kart ratings average performance with every partner; combined rates the actual
				pair. GP ratings average available races.
			</p>
			<p>
				Missing data and transitions are unrated. Individual ratings can use different race samples;
				combined requires both choices.
			</p>
			<p>
				<!-- Imported external source URL; not an application route. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={comboRatingSource}
					target="_blank"
					rel="noreferrer"
					class="text-foreground underline underline-offset-4">The Mario Kart World Statpedia</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</p>
		</div>
	</details>
</section>
