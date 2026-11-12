<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SearchBox from '$lib/components/custom/SearchBox.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { mode, toggleMode } from 'mode-watcher';
	import { cn } from '$lib/utils';

	const links = [
		{
			label: 'Players',
			href: resolve('/players'),
			active: (path: string) => path === '/players' || path.startsWith('/players/')
		},
		{
			label: 'Grand Prix',
			href: resolve('/grandprix'),
			active: (path: string) => path === '/grandprix' || path.startsWith('/grandprix/')
		},
		{
			label: 'Track stats',
			href: resolve('/track-stats'),
			active: (path: string) => path === '/track-stats'
		},
		{
			label: 'Stats',
			href: resolve('/stats'),
			active: (path: string) => path === '/stats'
		},
		{
			label: 'Records',
			href: resolve('/records'),
			active: (path: string) => path === '/records'
		},
		{
			label: 'Calculator',
			href: resolve('/stats/calculator'),
			active: (path: string) => path === '/stats/calculator'
		}
	];
</script>

<header class="border-border bg-background border-b">
	<div
		class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-2 sm:px-6 xl:flex-nowrap xl:py-2"
	>
		<a
			href={resolve('/')}
			class="focus-visible:outline-ring shrink-0 rounded-sm focus-visible:outline-2"
			aria-label="Lapita home"
		>
			<div class="flex items-center gap-2">
				<img src="/lapita-logo.png" alt="" class="h-12 w-12" />
				<span class="font-title text-lapita hidden text-3xl italic sm:block">lapita</span>
			</div>
		</a>
		<nav
			aria-label="Main navigation"
			class="order-last flex w-full flex-wrap gap-x-4 gap-y-0 xl:order-none xl:w-auto xl:gap-5"
		>
			{#each links as link (link.href)}
				{@const active = link.active(page.url.pathname)}
				<a
					href={link.href}
					aria-current={active ? 'page' : undefined}
					class={cn(
						'hover:text-foreground focus-visible:outline-ring border-b-2 border-transparent py-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:rounded-sm focus-visible:outline-2',
						active ? 'border-primary text-foreground' : 'text-muted-foreground'
					)}>{link.label}</a
				>
			{/each}
		</nav>
		<div class="flex min-w-0 flex-1 items-center gap-2 xl:ml-auto xl:max-w-sm">
			<div class="min-w-0 flex-1"><SearchBox /></div>
			<Button
				variant="outline"
				size="icon"
				class="size-10.5"
				onclick={toggleMode}
				aria-label={mode.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				title={mode.current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				<SunIcon class="hidden dark:block" aria-hidden="true" />
				<MoonIcon class="dark:hidden" aria-hidden="true" />
			</Button>
		</div>
	</div>
</header>
