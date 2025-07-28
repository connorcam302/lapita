<script lang="ts">
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import { navigationMenuTriggerStyle } from '../ui/navigation-menu/navigation-menu-trigger.svelte';
	import CarIcon from '@lucide/svelte/icons/car';
	import RoadIcon from '$lib/components/icon/RoadIcon.svelte';
	import { cn } from '$lib/utils';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';

	import { toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ChartBarIcon } from 'lucide-svelte';

	type ListItemProps = HTMLAttributes<HTMLAnchorElement> & {
		title: string;
		href: string;
		content: string;
	};
</script>

<div class="mx-auto flex max-w-3xl items-center justify-between">
	<a href="/">
		<div class="text-red flex items-center gap-2">
			<img src="/lapita-logo.png" alt="lapita" class="h-12 w-12" />
			<div class="font-title text-lapita text-3xl italic">lapita</div>
		</div>
	</a>
	<NavigationMenu.Root>
		<NavigationMenu.List>
			<!--
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a
							href="/tracks"
							class={cn(navigationMenuTriggerStyle(), 'flex items-center gap-2 text-lg')}
						>
							<RoadIcon class="text-2xl" />
							<div>Tracks</div>
						</a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a
							href="/racers"
							class={cn(navigationMenuTriggerStyle(), 'flex items-center gap-2 text-lg')}
						>
							<CarIcon class="text-2xl" />
							<div>Racers</div>
						</a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			--->
			<NavigationMenu.Item>
				<NavigationMenu.Link>
					{#snippet child()}
						<a
							href="/stats"
							class={cn(navigationMenuTriggerStyle(), 'flex items-center gap-2 text-lg')}
						>
							<ChartBarIcon class="text-2xl" />
							<div>Stats</div>
						</a>
					{/snippet}
				</NavigationMenu.Link>
			</NavigationMenu.Item>
			<NavigationMenu.Item>
				<Button onclick={toggleMode} variant="outline" size="icon">
					<SunIcon
						class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 !transition-all dark:scale-0 dark:-rotate-90"
					/>
					<MoonIcon
						class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 !transition-all dark:scale-100 dark:rotate-0"
					/>
					<span class="sr-only">Toggle theme</span>
				</Button>
			</NavigationMenu.Item>
		</NavigationMenu.List>
	</NavigationMenu.Root>
</div>
