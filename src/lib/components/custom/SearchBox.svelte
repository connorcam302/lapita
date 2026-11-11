<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { convexStore } from '$lib/stores/states.svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '../../../convex/_generated/api';
	import { Search, X, ArrowUpRight } from 'lucide-svelte';
	import { tick } from 'svelte';

	type Option = { label: string; href: string; keywords?: string; image?: string; detail: string };
	type Group = { header: string; options: Option[] };
	let { placeholder = 'Search Lapita…' }: { placeholder?: string } = $props();
	const id = $props.id();
	let searchValue = $state('');
	let isOpen = $state(false);
	let searchInput: HTMLInputElement;
	let selectedIndex = $state(-1);
	let requestedGps = $state(false);
	const recentGps = useQuery(api.gps.getAll, () => (requestedGps ? { pageSize: 12 } : 'skip'));
	const terms = $derived(searchValue.trim().toLowerCase().split(/\s+/).filter(Boolean));
	const groups: Group[] = $derived([
		{
			header: 'Explore',
			options: [
				{
					label: 'Grand Prix',
					href: resolve('/'),
					keywords: 'home standings races results',
					detail: 'Latest GP & standings'
				},
				{
					label: 'All Grand Prix',
					href: resolve('/grandprix'),
					keywords: 'previous grand prix past results archive search filter history',
					detail: 'Search & filter every Grand Prix'
				},
				{
					label: 'Track stats',
					href: resolve('/track-stats'),
					keywords: 'courses circuits averages records',
					detail: 'Track performance'
				},
				{
					label: 'Records',
					href: resolve('/records'),
					keywords: 'records achievements wins podiums streaks best scores rankings',
					detail: 'All-time player records'
				},
				{
					label: 'Calculator',
					href: resolve('/stats/calculator'),
					keywords: 'combo character kart speed handling acceleration weight',
					detail: 'Compare character & kart stats'
				}
			]
		},
		{
			header: 'Players',
			options: (convexStore.allUsers ?? []).map((player) => ({
				label: player.name,
				href: resolve('/players/[userId]', { userId: player._id }),
				keywords: 'player racer history',
				detail: 'Player history & stats'
			}))
		},
		{
			header: 'Recent Grand Prix',
			options: (recentGps.data?.page ?? []).map((gp) => ({
				label: `Grand Prix ${gp.order}`,
				href: resolve('/grandprix/[id]', { id: gp.grandPrixId }),
				keywords: `gp ${gp.order} race results`,
				detail: `${gp.completedRaces}/${gp.raceCount} races complete`
			}))
		},
		{
			header: 'Tracks',
			options: (convexStore.allTracks ?? []).map((track) => ({
				label: track.name,
				href: resolve('/tracks/[trackId]', { trackId: track._id }),
				image: `/tracks/icons/${track.img}.png`,
				keywords: 'track course circuit',
				detail: 'View track stats'
			}))
		},
		{
			header: 'Characters',
			options: (convexStore.allCharacters ?? [])
				.filter((character) => character.name)
				.map((character) => ({
					label: character.name!,
					href: `${resolve('/stats/calculator')}?character=${encodeURIComponent(character._id)}`,
					image: character.img ? `/characters/${character.img}.png` : undefined,
					keywords: 'character combo stats',
					detail: 'Open in calculator'
				}))
		},
		{
			header: 'Karts',
			options: (convexStore.allKarts ?? []).map((kart) => ({
				label: kart.name,
				href: `${resolve('/stats/calculator')}?kart=${encodeURIComponent(kart._id)}`,
				image: `/karts/${kart.img}.png`,
				keywords: 'kart vehicle combo stats',
				detail: 'Open in calculator'
			}))
		}
	]);
	const filteredGroups = $derived(
		groups
			.map((group) => ({
				...group,
				options: group.options.filter((option) =>
					terms.every((term) =>
						`${option.label} ${option.keywords ?? ''}`.toLowerCase().includes(term)
					)
				)
			}))
			.filter((group) => group.options.length)
	);
	const options = $derived(filteredGroups.flatMap((group) => group.options));

	afterNavigate(() => {
		isOpen = false;
		searchValue = '';
		selectedIndex = -1;
	});

	function open() {
		isOpen = true;
		requestedGps = true;
	}
	function close() {
		isOpen = false;
		selectedIndex = -1;
	}
	async function select(option: Option) {
		close();
		searchInput?.blur();
		// Every option is built with resolve() above, including query strings.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(option.href);
	}
	async function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			open();
			selectedIndex = options.length
				? ((selectedIndex < 0 && event.key === 'ArrowUp' ? 0 : selectedIndex) +
						(event.key === 'ArrowDown' ? 1 : -1) +
						options.length) %
					options.length
				: -1;
			await tick();
			document
				.getElementById(`${id}-option-${selectedIndex}`)
				?.scrollIntoView({ block: 'nearest' });
		} else if (event.key === 'Enter' && isOpen && options.length) {
			event.preventDefault();
			await select(options[Math.max(0, selectedIndex)]);
		}
	}
</script>

<div
	class="relative w-full py-2 font-sans"
	onfocusout={(event) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
	}}
>
	<div class="relative flex items-center">
		<Search
			aria-hidden="true"
			class="text-muted-foreground pointer-events-none absolute left-3 size-4"
		/>
		<input
			bind:this={searchInput}
			bind:value={searchValue}
			oninput={() => {
				open();
				selectedIndex = -1;
			}}
			onfocus={open}
			onclick={open}
			onkeydown={handleKeydown}
			{placeholder}
			aria-label="Search Lapita"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={isOpen}
			aria-controls={`${id}-results`}
			aria-activedescendant={isOpen && selectedIndex >= 0
				? `${id}-option-${selectedIndex}`
				: undefined}
			autocomplete="off"
			class="bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full rounded-md border py-2.5 pr-10 pl-9 text-sm outline-none focus-visible:ring-2"
		/>
		{#if searchValue}<button
				type="button"
				aria-label="Clear search"
				class="text-muted-foreground hover:text-foreground focus-visible:outline-ring absolute right-1 rounded-sm p-2 focus-visible:outline-2"
				onclick={() => {
					searchValue = '';
					selectedIndex = -1;
					searchInput.focus();
				}}><X class="size-4" /></button
			>{/if}
	</div>
	{#if isOpen}
		<div
			class="bg-popover text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border shadow-lg sm:left-auto sm:w-[26rem]"
		>
			<div
				id={`${id}-results`}
				role="listbox"
				aria-label="Search results"
				class="max-h-[min(28rem,60dvh)] overflow-y-auto overscroll-contain p-1"
			>
				{#each filteredGroups as group (group.header)}
					<div role="group" aria-label={group.header}>
						<div class="text-muted-foreground px-3 pt-3 pb-1 text-xs font-semibold">
							{group.header}
						</div>
						{#each group.options as option (option.href)}
							{@const index = options.indexOf(option)}
							<button
								id={`${id}-option-${index}`}
								role="option"
								aria-selected={selectedIndex === index}
								tabindex="-1"
								type="button"
								onpointerdown={(event) => event.preventDefault()}
								onclick={() => select(option)}
								class="hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left focus-visible:outline-2 {selectedIndex ===
								index
									? 'bg-accent text-accent-foreground'
									: ''}"
							>
								{#if option.image}<img
										src={option.image}
										alt=""
										class="size-8 shrink-0 object-contain"
									/>{/if}
								<span class="min-w-0 flex-1"
									><span class="block text-sm font-medium">{option.label}</span><span
										class="text-muted-foreground block text-xs">{option.detail}</span
									></span
								><ArrowUpRight aria-hidden="true" class="text-muted-foreground size-3.5 shrink-0" />
							</button>
						{/each}
					</div>
				{:else}<p class="text-muted-foreground px-3 py-6 text-sm" role="status">
						No matches for “{searchValue.trim()}”. Try a player, track, character, or kart.
					</p>{/each}
				{#if !convexStore.isLoaded}<p role="status" class="text-muted-foreground px-3 py-2 text-xs">
						Loading players, tracks, and combos…
					</p>{/if}
				{#if recentGps.isLoading}<p role="status" class="text-muted-foreground px-3 py-2 text-xs">
						Loading recent Grand Prix…
					</p>{:else if recentGps.error}<p
						role="status"
						class="text-muted-foreground px-3 py-2 text-xs"
					>
						Recent Grand Prix unavailable. Browse race history from Home.
					</p>{/if}
			</div>
			<p class="text-muted-foreground border-t px-3 py-2 text-xs">
				↑ ↓ to browse · Enter to open · Esc to close
			</p>
		</div>
	{/if}
</div>
