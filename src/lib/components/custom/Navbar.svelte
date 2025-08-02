<script lang="ts">
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import SearchBox from '$lib/components/custom/SearchBox.svelte';
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
	<SearchBox />
</div>
