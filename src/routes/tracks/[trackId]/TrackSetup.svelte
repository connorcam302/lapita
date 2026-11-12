<script lang="ts">
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import {
		comboCoverageSource,
		comboRatingSource,
		coverageByTrack,
		groupTrackCombos,
		rankTrackCombos
	} from '$lib/gp-combo-fit';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	let { trackName }: { trackName: string } = $props();
	const coverage = $derived(coverageByTrack.get(trackName));
	const recommendations = $derived(
		groupTrackCombos(
			rankTrackCombos(trackName, convexStore.allCharacters ?? [], convexStore.allKarts ?? [])
		).slice(0, 5)
	);
	const surfaces = [
		{ key: 'road', label: 'Road', color: 'bg-lapita' },
		{ key: 'rough', label: 'Rough terrain', color: 'bg-emerald-600 dark:bg-emerald-400' },
		{ key: 'water', label: 'Water', color: 'bg-blue-600 dark:bg-blue-400' },
		{ key: 'gliding', label: 'Gliding', color: 'bg-violet-600 dark:bg-violet-400' },
		{ key: 'neutral', label: 'Neutral', color: 'bg-muted-foreground' }
	] as const;
</script>

<Card.Root>
	<Card.Header>
		<h2 class="font-title text-lg">Terrain breakdown</h2>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if coverage}
			<div class="flex h-4 overflow-hidden rounded-sm" aria-hidden="true">
				{#each surfaces as surface (surface.key)}
					<div class={surface.color} style:width={`${coverage[surface.key]}%`}></div>
				{/each}
			</div>
			<dl class="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5">
				{#each surfaces as surface (surface.key)}
					<div>
						<dt class="text-muted-foreground flex items-center gap-2 text-sm">
							<span class={`size-2 shrink-0 rounded-sm ${surface.color}`} aria-hidden="true"
							></span>{surface.label}
						</dt>
						<dd class="mt-1 text-lg tabular-nums">{coverage[surface.key]}%</dd>
					</div>
				{/each}
			</dl>
		{:else}
			<p class="text-muted-foreground text-sm">
				Statpedia terrain estimates are not available for this track yet.
			</p>
		{/if}
		<p class="text-muted-foreground text-xs">
			<!-- Imported external source URL, not an application route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			Source:
			<a
				class="underline underline-offset-4"
				href={comboCoverageSource}
				target="_blank"
				rel="noreferrer">The Mario Kart World Statpedia · VS Races</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	</Card.Content>
</Card.Root>

<Card.Root>
	<Card.Header>
		<h2 class="font-title text-lg">Top 5 combinations</h2>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if recommendations.length}
			<Table.Root class="table-fixed">
				<Table.Header
					><Table.Row>
						<Table.Head class="w-8"><span class="sr-only">Rank</span></Table.Head>
						<Table.Head>Character & kart</Table.Head>
						<Table.Head class="w-20 text-right text-xs sm:w-24">Rating /100</Table.Head>
					</Table.Row></Table.Header
				>
				<Table.Body>
					{#each recommendations as group, index (group.rating)}
						<Table.Row class="hover:bg-transparent">
							<Table.Cell class="py-4 align-top">
								<span
									class="bg-muted text-muted-foreground inline-flex size-6 items-center justify-center rounded-sm text-xs font-medium tabular-nums"
									>{index + 1}</span
								>
							</Table.Cell>
							<Table.Cell class="py-4 whitespace-normal">
								<div class="space-y-4">
									{#each group.setups as setup (setup.kart._id)}
										<div class="grid gap-2 md:grid-cols-[11rem_1fr] md:items-center md:gap-4">
											<div class="flex min-w-0 items-center gap-2 font-medium">
												{#if setup.kart.img}<img
														src={`/karts/${setup.kart.img}.png`}
														alt=""
														class="size-10 shrink-0 object-contain"
														loading="lazy"
													/>{/if}
												{setup.kart.name}
											</div>
											<div class="flex min-w-0 flex-wrap gap-x-3 gap-y-2">
												{#each setup.characters as character (character._id)}
													<a
														class="text-muted-foreground hover:text-foreground focus-visible:outline-ring flex min-w-0 items-center gap-1 rounded-sm text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
														href={resolve(
															`/stats/calculator?character=${character._id}&kart=${setup.kart._id}`
														)}
													>
														{#if character.img}<img
																src={`/characters/${character.img}.png`}
																alt=""
																class="size-7 shrink-0 object-contain"
																loading="lazy"
															/>{/if}
														{character.name}
													</a>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</Table.Cell>
							<Table.Cell class="py-5 text-right align-top font-medium tabular-nums"
								>{group.rating}</Table.Cell
							>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else}
			<p class="text-muted-foreground text-sm">
				{coverage
					? 'No available character and kart pairs have matching Statpedia stats.'
					: 'Recommendations will appear when terrain estimates are available.'}
			</p>
		{/if}
		<p class="text-muted-foreground text-xs">
			<!-- Imported external source URL, not an application route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			Source:
			<a
				class="underline underline-offset-4"
				href={comboRatingSource}
				target="_blank"
				rel="noreferrer">The Mario Kart World Statpedia · Combo Rankings WIP</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	</Card.Content>
</Card.Root>
