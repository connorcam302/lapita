<script lang="ts">
	import { resolve } from '$app/paths';
	import { useRecoverableQuery as useQuery } from '$lib/use-recoverable-query.svelte';
	import { api } from '../../../../convex/_generated/api';
	import type { PageData } from './$types';
	import { convexStore } from '$lib/stores/states.svelte';
	import { buildRecap } from '$lib/gp-recap';
	import { createRecapImage, copyRecapImage, imageCopyErrorMessage } from '$lib/recap-image';
	import { onDestroy } from 'svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import PositionBadge from '$lib/components/custom/PositionBadge.svelte';
	import ComboFit from './ComboFit.svelte';
	import { buildGpComboFit } from '$lib/gp-combo-fit';
	import { calculateStartingGpOutlook } from '../gp-outlook';
	import { calculatePointsComparison } from '../expected-points';

	let { data }: { data: PageData } = $props();
	const gpQuery = useQuery(api.gps.getOne, () => ({ id: data.grandPrix._id }));
	const resultQuery = useQuery(api.results.get, () => ({ grandPrixId: data.grandPrix._id }));
	const gp = $derived(gpQuery.data);
	const recap = $derived(
		gp ? buildRecap(gp.participants, resultQuery.data ?? [], gp.completedAt) : null
	);
	const statsQuery = useQuery(api.results.stats, () =>
		gp && resultQuery.data?.length
			? {
					tracks: [...new Set(resultQuery.data.map((race) => race.trackEndId))],
					users: gp.participants
				}
			: 'skip'
	);
	const comparisons = $derived(
		gp && resultQuery.data && statsQuery.data && !statsQuery.error
			? calculatePointsComparison(gp.participants, resultQuery.data, statsQuery.data)
			: []
	);

	const startingStats = useQuery(api.results.stats, () =>
		gp && resultQuery.data?.length
			? {
					tracks: [...new Set(resultQuery.data.map((race) => race.trackEndId))],
					users: gp.participants,
					beforeGrandPrixId: gp._id
				}
			: 'skip'
	);
	const startingOutlook = $derived(
		gp && resultQuery.data && startingStats.data && !startingStats.error
			? calculateStartingGpOutlook(gp.participants, resultQuery.data, startingStats.data)
			: null
	);
	const comboRatings = $derived(
		gp
			? buildGpComboFit(gp.participants, resultQuery.data ?? [], {
					tracks: convexStore.allTracks ?? [],
					characters: convexStore.allCharacters ?? [],
					karts: convexStore.allKarts ?? []
				})
			: []
	);

	const name = (id: string) =>
		convexStore.allUsers?.find((user) => user._id === id)?.name ?? 'Unknown racer';
	let exporting = $state(false);
	let exportError = $state('');
	let previewOpen = $state(false);
	let previewUrl = $state('');
	let previewBlob = $state<Blob | null>(null);
	let previewOrder = $state(0);
	let copying = $state(false);
	let copied = $state(false);
	let copyError = $state('');
	let copyErrorDetail = $state('');
	let generation = 0;
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => {
		generation++;
		clearTimeout(copyFeedbackTimer);
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});
	async function showImage() {
		if (!recap || !gp || exporting) return;
		const current = ++generation;
		previewOrder = gp.order;
		previewOpen = true;
		exporting = true;
		exportError = '';
		copyError = '';
		copyErrorDetail = '';
		clearTimeout(copyFeedbackTimer);
		copied = false;
		copying = false;
		previewBlob = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = '';
		try {
			const blob = await createRecapImage(gp.order, recap, name, {
				comparisons,
				startingPlayers: startingOutlook?.players ?? [],
				comboRatings
			});
			if (current !== generation) return;
			previewBlob = blob;
			previewUrl = URL.createObjectURL(blob);
		} catch {
			if (current === generation) exportError = 'Could not create the image. Please try again.';
		} finally {
			if (current === generation) exporting = false;
		}
	}
	async function copyImage() {
		if (!previewBlob || copying) return;
		const current = generation;
		copying = true;
		copied = false;
		clearTimeout(copyFeedbackTimer);
		copyError = '';
		copyErrorDetail = '';
		try {
			await copyRecapImage(previewBlob);
			if (current === generation) {
				copied = true;
				toast.success('Image copied');
				copyFeedbackTimer = setTimeout(() => {
					if (current === generation) copied = false;
				}, 2500);
			}
		} catch (error) {
			if (current === generation) {
				const policy = (
					document as Document & {
						permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
					}
				).permissionsPolicy;
				copyError = imageCopyErrorMessage(error, {
					secure: window.isSecureContext,
					supported: Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined',
					policyAllowed: policy?.allowsFeature('clipboard-write') ?? true
				});
				copyErrorDetail =
					error instanceof Error ? `${error.name}: ${error.message}` : String(error);
			}
		} finally {
			if (current === generation) copying = false;
		}
	}
</script>

<svelte:head>
	<title>Grand Prix {data.grandPrix.order} recap · Lapita</title>
	<meta
		name="description"
		content="Grand Prix standings, xPoints and kart and character ratings."
	/>
</svelte:head>

<main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
	<header class="mb-8 flex flex-wrap items-center justify-between gap-4">
		<h1 class="font-title text-2xl sm:text-3xl">Grand Prix {data.grandPrix.order} recap</h1>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={resolve('/grandprix/[id]', { id: data.grandPrix._id })}
				>Detailed results</Button
			>
			{#if recap?.complete && !gpQuery.error && !resultQuery.error}
				<Button
					variant="secondary"
					disabled={exporting || statsQuery.isLoading || startingStats.isLoading}
					onclick={showImage}>{exporting ? 'Creating image…' : 'Recap image'}</Button
				>
			{/if}
		</div>
	</header>
	{#if gpQuery.error || resultQuery.error}
		<section role="alert" class="bg-card rounded-md border p-6">
			<h2 class="font-body text-2xl">Could not load the recap</h2>
			<p class="text-muted-foreground mt-2">Check your connection and try again.</p>
			<Button
				class="mt-4"
				variant="outline"
				onclick={() => {
					gpQuery.retry();
					resultQuery.retry();
				}}>Try again</Button
			>
		</section>
	{:else if gpQuery.isLoading || resultQuery.isLoading}
		<p role="status" class="text-muted-foreground py-10">Loading recorded results…</p>
	{:else if !gp}
		<p role="status">This Grand Prix is unavailable. It may have been deleted.</p>
	{:else if !recap?.complete}
		<section class="bg-card rounded-md border p-6">
			<h2 class="font-body text-2xl">No completed recap yet</h2>
			<p class="text-muted-foreground mt-2">Complete this Grand Prix to see its recap.</p>
		</section>
	{:else}
		{#if !recap.fullHistory}
			<aside class="bg-card mb-6 rounded-md border p-5" aria-label="Incomplete race history">
				<h2 class="font-semibold">Manually completed</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					{recap.missing} finishes missing or invalid. Points and wins use recorded results only.
				</p>
			</aside>
		{/if}
		<section aria-labelledby="podium-heading" class="bg-card overflow-hidden rounded-md border">
			<div class="bg-lapita p-5 text-neutral-900 sm:p-6">
				<h2 id="podium-heading" class="font-title text-2xl">Podium</h2>
				<p class="mt-2 text-sm">
					{recap.raceCount} races · {recap.standings.length} racers · {recap.margin === null
						? 'No runner-up'
						: recap.margin === 0
							? 'Shared victory · 0-point winning margin'
							: `${recap.margin}-point winning margin`}
				</p>
			</div>
			<ol class="grid gap-5 p-5 sm:grid-cols-3 sm:p-6" aria-label="Podium with shared places">
				{#each recap.podium as racer (racer.userId)}
					<li class="flex min-w-0 items-start gap-3">
						<PositionBadge position={racer.rank} />
						<div class="min-w-0">
							<a
								class="font-body text-2xl break-words underline-offset-4 hover:underline"
								href={resolve('/players/[userId]', { userId: racer.userId })}
								>{name(racer.userId)}</a
							>
							<p class="text-muted-foreground text-sm">
								{racer.points} points · {racer.wins} race {racer.wins === 1 ? 'win' : 'wins'}
							</p>
						</div>
					</li>
				{/each}
			</ol>
		</section>

		<section class="mt-8" aria-labelledby="standings-heading">
			<h2 id="standings-heading" class="font-body mb-3 text-2xl font-semibold">Standings</h2>
			<div class="bg-card overflow-x-auto rounded-md border">
				<table class="w-full text-left text-sm">
					<caption class="sr-only"
						>Final points from recorded finishes. Tied scores share competition ranks.</caption
					>
					<thead class="border-b"
						><tr
							><th class="p-3">Rank</th><th class="p-3">Racer</th><th class="p-3 text-right"
								>Points</th
							><th
								class="p-3 text-right"
								title="Reconstructed from current track history, including this GP; not a saved prediction."
								>xPoints</th
							><th
								class="p-3 text-right"
								title="Reconstructed using earlier GPs only; not a saved pre-race prediction."
								>Win chance</th
							><th class="p-3 text-right">Race wins</th>{#if !recap.fullHistory}<th
									class="p-3 text-right">Finishes recorded</th
								>{/if}</tr
						></thead
					>
					<tbody
						>{#each recap.standings as racer (racer.userId)}{@const comparison = comparisons.find(
								(row) => row.userId === racer.userId
							)}<tr class="hover:bg-muted/50 border-b last:border-0"
								><td class="p-3"><PositionBadge position={racer.rank} /></td><th
									scope="row"
									class="p-3 font-medium"
									><a
										class="underline-offset-4 hover:underline"
										href={resolve('/players/[userId]', { userId: racer.userId })}
										>{name(racer.userId)}</a
									></th
								><td class="p-3 text-right tabular-nums">{racer.points}</td>
								<td class="p-3 text-right whitespace-nowrap tabular-nums">
									{comparison?.expected ?? '—'}
									{#if comparison?.difference != null}
										<span
											class="text-xs"
											title="Actual points minus xPoints"
											class:text-green-700={comparison.difference > 0}
											class:dark:text-green-400={comparison.difference > 0}
											class:text-red-600={comparison.difference < 0}
											class:dark:text-red-400={comparison.difference < 0}
										>
											({comparison.difference > 0 ? '+' : ''}{comparison.difference})
										</span>
									{/if}
								</td><td class="p-3 text-right tabular-nums"
									>{startingOutlook?.players
										.find((player) => player.userId === racer.userId)
										?.winChance?.toFixed(1) ?? '—'}{startingOutlook?.players.find(
										(player) => player.userId === racer.userId
									)?.winChance != null
										? '%'
										: ''}</td
								><td class="p-3 text-right tabular-nums">{racer.wins}</td
								>{#if !recap.fullHistory}<td class="p-3 text-right tabular-nums"
										>{racer.recorded}/{recap.raceCount}</td
									>{/if}</tr
							>{/each}</tbody
					>
				</table>
			</div>
			{#if startingStats.error}<p class="mt-2 text-sm" role="alert">
					Could not load win chances. <button
						class="rounded-sm underline underline-offset-4 focus-visible:ring-2"
						onclick={startingStats.retry}>Try again</button
					>
				</p>
			{:else if startingStats.isLoading}<p class="text-muted-foreground mt-2 text-sm" role="status">
					Loading win chances…
				</p>
			{:else if startingOutlook?.players.some((player) => player.winChance === null)}<p
					class="text-muted-foreground mt-2 text-sm"
				>
					Win chance unavailable for racers without enough earlier history.
				</p>{/if}

			{#if statsQuery.error}<p class="mt-2 text-sm" role="alert">
					Could not load xPoints. <button
						class="underline underline-offset-4"
						onclick={statsQuery.retry}>Try again</button
					>
				</p>
			{:else if statsQuery.isLoading}<p class="text-muted-foreground mt-2 text-sm" role="status">
					Loading xPoints…
				</p>
			{:else if comparisons.some((row) => row.expected === null)}<p
					class="text-muted-foreground mt-2 text-sm"
				>
					xPoints unavailable without recorded finishes or enough track history.
				</p>{/if}
		</section>

		<ComboFit ratings={comboRatings} {name} />
	{/if}
</main>

<Dialog.Root bind:open={previewOpen}>
	<Dialog.Content
		class="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-5xl"
	>
		<Dialog.Header class="pr-8">
			<Dialog.Title>Grand Prix {previewOrder} recap image</Dialog.Title>
			<Dialog.Description class="sr-only">Copy or download the recap image.</Dialog.Description>
		</Dialog.Header>
		<div class="min-h-0 overflow-y-auto overscroll-contain">
			{#if exporting}
				<p class="text-muted-foreground py-12 text-center" role="status">Creating image…</p>
			{:else if exportError}
				<div class="space-y-3 py-6" role="alert">
					<p>{exportError}</p>
					<Button variant="outline" onclick={showImage}>Try again</Button>
				</div>
			{:else if previewUrl}
				{#if copyError}<div class="mb-3 space-y-2 text-sm" role="alert">
						<p>{copyError}</p>
						<details class="text-muted-foreground">
							<summary class="cursor-pointer">Error details</summary>
							<p class="mt-1 break-words">{copyErrorDetail}</p>
						</details>
					</div>{/if}
				<div class="relative">
					<img
						src={previewUrl}
						alt={`Grand Prix ${previewOrder} recap`}
						width="1200"
						class="h-auto w-full rounded-sm"
					/>
					<Button
						variant={copied ? 'secondary' : 'outline'}
						size="icon"
						class={`absolute top-3 right-3 shadow-sm active:scale-95 motion-reduce:transform-none ${copied ? '' : 'bg-background'}`}
						onclick={copyImage}
						disabled={!previewBlob || copying}
						aria-label={copying ? 'Copying image' : copied ? 'Image copied' : 'Copy image'}
						aria-busy={copying}
						title={copying ? 'Copying image…' : copied ? 'Copied' : 'Copy image'}
					>
						{#if copying}<LoaderCircle
								class="animate-spin motion-reduce:animate-none"
								aria-hidden="true"
							/>{:else if copied}<Check aria-hidden="true" />{:else}<Copy aria-hidden="true" />{/if}
					</Button>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			{#if previewUrl}<Button
					variant="outline"
					href={previewUrl}
					download={`lapita-gp-${previewOrder}-recap.png`}>Download</Button
				>{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
