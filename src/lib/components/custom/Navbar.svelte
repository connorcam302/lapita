<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SearchBox from '$lib/components/custom/SearchBox.svelte';
	import { cn } from '$lib/utils';

	const links = [
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
		class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 pt-2 sm:px-6 lg:flex-nowrap lg:py-2"
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
			class="order-last flex w-full gap-4 lg:order-none lg:w-auto lg:gap-5"
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
		<div class="min-w-0 flex-1 lg:ml-auto lg:max-w-sm"><SearchBox /></div>
	</div>
</header>
