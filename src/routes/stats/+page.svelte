<script lang="ts">
	import { resolve } from '$app/paths';
	import { useQuery } from 'convex-svelte';
	import { LineChart, BarChart } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import { curveLinear } from 'd3-shape';
	import { api } from '../../convex/_generated/api';
	import { chartColours } from '$lib/utils';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Chart from '$lib/components/ui/chart/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import StatsBars from './StatsBars.svelte';
	import { groupGpActivity } from '$lib/gp-activity';
	import { groupEraBands } from '$lib/gp-era-bands';

	const stats = useQuery(api.records.stats, {});
	let metric = $state<'gpWins' | 'raceWins'>('gpWins');
	let hiddenPlayers = $state<string[]>([]);
	let ranking = $state<'wins' | 'gpWins' | 'winRate' | 'podiums' | 'average' | 'points' | 'races'>(
		'wins'
	);
	const players = $derived(stats.data?.players.filter((p) => p.races > 0 || p.gpEntries > 0) ?? []);
	const visiblePlayers = $derived(players.filter((p) => !hiddenPlayers.includes(p.userId)));
	const series = $derived(
		visiblePlayers.map((p) => ({
			key: p.userId,
			label: p.name,
			color: chartColours[players.indexOf(p) % chartColours.length]
		}))
	);
	const config = $derived(
		Object.fromEntries(
			series.map((s) => [s.key, { label: s.label, color: s.color }])
		) satisfies Chart.ChartConfig
	);
	const timeline = $derived(
		stats.data?.timeline.map((gp) => ({ order: gp.order, era: gp.era, ...gp[metric] })) ?? []
	);
	const eraBands = $derived(groupEraBands(stats.data?.timeline ?? []));
	const timelineDomain = $derived<[number, number]>([
		(timeline[0]?.order ?? 1) - 0.5,
		(timeline.at(-1)?.order ?? 1) + 0.5
	]);
	const rankedPlayers = $derived(
		[...players].sort((a, b) =>
			ranking === 'average'
				? (a.average ?? Infinity) - (b.average ?? Infinity) || a.name.localeCompare(b.name)
				: b[ranking] - a[ranking] || a.name.localeCompare(b.name)
		)
	);
	const activity = $derived(groupGpActivity(stats.data?.timeline ?? []));
	const activityConfig = {
		gps: { label: 'Grand Prix started', color: 'var(--chart-1)' }
	} satisfies Chart.ChartConfig;
	const averagePoints = $derived(
		[...players]
			.filter((p) => p.races > 0)
			.sort((a, b) => b.points / b.races - a.points / a.races)
			.map((p) => ({
				name: `${p.name} (${p.races})`,
				value: Math.round((p.points / p.races) * 100) / 100
			}))
	);
	const averageFinishes = $derived(
		[...players]
			.filter((p) => p.average !== null)
			.sort((a, b) => a.average! - b.average!)
			.map((p) => ({ name: `${p.name} (${p.races})`, value: Math.round(p.average! * 100) / 100 }))
	);
	const winRates = $derived(
		[...players]
			.filter((p) => p.races > 0)
			.sort((a, b) => b.winRate - a.winRate)
			.map((p) => ({ name: `${p.name} (${p.races})`, value: Math.round(p.winRate * 10) / 10 }))
	);
	function togglePlayer(id: string) {
		hiddenPlayers = hiddenPlayers.includes(id)
			? hiddenPlayers.filter((value) => value !== id)
			: [...hiddenPlayers, id];
	}
</script>

<svelte:head>
	<title>Stats · Lapita</title>
	<meta
		name="description"
		content="Explore Lapita in numbers: GP and race wins over time, player performance, average points per race, average finishes, GP activity and favourite combinations."
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
	<header class="border-b pb-7">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="font-title text-2xl sm:text-3xl">Stats</h1>
			<Button variant="outline" size="sm" href={resolve('/records')}>All-time records</Button>
		</div>
	</header>
	{#if stats.error}
		<section class="py-12" role="alert">
			<h2 class="text-xl font-semibold">Could not load stats</h2>
			<p class="text-muted-foreground mt-2">Check your connection and reload to try again.</p>
			<Button variant="outline" class="mt-4" onclick={() => window.location.reload()}
				>Reload page</Button
			>
		</section>
	{:else if !stats.data}
		<p class="text-muted-foreground py-12" role="status">Loading race history and stats…</p>
	{:else if stats.data.completedRaces === 0 && stats.data.completedGps === 0}
		<section class="py-12">
			<h2 class="font-title text-xl">Your stats start on the track</h2>
			<p class="text-muted-foreground mt-3">
				Complete a race with a valid finish for every participant to see player comparisons and
				charts.
			</p>
			<Button variant="secondary" class="mt-5" href={resolve('/')}>View Grand Prix</Button>
		</section>
	{:else}
		<dl
			class="bg-card mt-6 grid grid-cols-2 gap-x-6 gap-y-5 rounded-md border p-4 sm:grid-cols-4 sm:p-6"
		>
			{#each [{ label: 'Completed Grand Prix', value: stats.data.completedGps }, { label: 'Completed races', value: stats.data.completedRaces }, { label: 'Racers', value: players.length }, { label: 'Tracks raced', value: stats.data.tracks.length }] as stat (stat.label)}
				<div>
					<dt class="text-muted-foreground text-sm">{stat.label}</dt>
					<dd class="mt-1 text-3xl font-semibold tabular-nums">{stat.value.toLocaleString()}</dd>
				</div>
			{/each}
		</dl>

		<section class="bg-card mt-6 rounded-md border p-4 sm:p-6" aria-labelledby="wins-heading">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 id="wins-heading" class="font-title text-xl">Wins over time</h2>
					<p class="text-muted-foreground mt-2 text-sm">
						Cumulative {metric === 'gpWins' ? 'GP wins' : 'first-place race finishes'}, in Grand
						Prix order.
					</p>
				</div>
				<div class="flex gap-1 rounded-md border p-1" role="group" aria-label="Win type">
					<Button
						size="sm"
						variant={metric === 'gpWins' ? 'secondary' : 'ghost'}
						aria-pressed={metric === 'gpWins'}
						onclick={() => (metric = 'gpWins')}>GP wins</Button
					>
					<Button
						size="sm"
						variant={metric === 'raceWins' ? 'secondary' : 'ghost'}
						aria-pressed={metric === 'raceWins'}
						onclick={() => (metric = 'raceWins')}>Race wins</Button
					>
				</div>
			</div>
			<div class="mt-5 flex flex-wrap gap-2" role="group" aria-label="Players shown in wins chart">
				{#each players as player, index (player.userId)}
					<button
						type="button"
						aria-pressed={!hiddenPlayers.includes(player.userId)}
						onclick={() => togglePlayer(player.userId)}
						class="focus-visible:ring-ring flex items-center gap-2 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 {hiddenPlayers.includes(
							player.userId
						)
							? 'text-muted-foreground border-dashed'
							: 'bg-muted text-foreground'}"
						><span
							class="size-2.5 rounded-full"
							style:background={chartColours[index % chartColours.length]}
						></span>{player.name}</button
					>
				{/each}
			</div>
			{#if eraBands.length}
				<div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Era colors">
					{#each eraBands as band (`${band.era}-${band.from}`)}
						<a
							href={resolve(`/grandprix?era=${encodeURIComponent(band.era)}`)}
							class="focus-visible:ring-ring flex max-w-full items-baseline gap-2 rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
						>
							<span
								class="size-3 shrink-0 self-center rounded-sm"
								style:background={band.color}
								aria-hidden="true"
							></span>
							<span class="min-w-0 break-words"
								>{band.era}
								<span class="text-muted-foreground"
									>· {band.from === band.to
										? `GP ${band.from}`
										: `GPs ${band.from}–${band.to}`}</span
								></span
							>
						</a>
					{/each}
				</div>
			{/if}
			{#if visiblePlayers.length}
				<Chart.Container
					{config}
					class="mt-6 aspect-auto h-80 w-full sm:h-96"
					aria-label={`Cumulative ${metric === 'gpWins' ? 'GP wins' : 'race wins'} by Grand Prix`}
				>
					<LineChart
						data={timeline}
						x="order"
						xDomain={timelineDomain}
						xNice={false}
						{series}
						yDomain={[0, null]}
						rule={false}
						props={{
							spline: { curve: curveLinear, strokeWidth: 2 },
							xAxis: {
								format: (value) => (Number.isInteger(value) ? `GP ${value}` : ''),
								ticks: Math.min(6, timeline.length)
							},
							yAxis: { format: (value) => (Number.isInteger(value) ? `${value}` : '') }
						}}
					>
						{#snippet belowMarks({ context })}
							<g class="pointer-events-none" aria-hidden="true">
								{#each eraBands as band (`${band.era}-${band.from}`)}
									<rect
										x={context.xScale(band.from - 0.5)}
										y={0}
										width={Math.max(
											0,
											context.xScale(band.to + 0.5) - context.xScale(band.from - 0.5)
										)}
										height={context.height}
										fill={band.color}
										fill-opacity={0.16}
									/>
								{/each}
							</g>
						{/snippet}
						{#snippet tooltip()}<Chart.Tooltip
								labelFormatter={(_, payload) =>
									`Grand Prix ${payload[0]?.payload?.order ?? ''} · ${payload[0]?.payload?.era ?? 'No era'}`}
							/>{/snippet}
					</LineChart>
				</Chart.Container>
			{:else}<p class="text-muted-foreground py-16 text-center" role="status">
					Select a player to show their wins.
				</p>{/if}
			<details class="mt-4 text-sm">
				<summary
					class="text-muted-foreground focus-visible:outline-ring w-fit cursor-pointer rounded-sm focus-visible:outline-2"
					>View wins over time data</summary
				>
				<div class="mt-3 overflow-x-auto">
					<Table.Root
						><Table.Header
							><Table.Row
								><Table.Head>Grand Prix</Table.Head><Table.Head>Era</Table.Head
								>{#each visiblePlayers as player (player.userId)}<Table.Head class="text-right"
										>{player.name}</Table.Head
									>{/each}</Table.Row
							></Table.Header
						><Table.Body
							>{#each stats.data.timeline as gp (gp.grandPrixId)}<Table.Row
									><Table.Cell
										><a
											class="underline underline-offset-4"
											href={resolve('/grandprix/[id]', { id: gp.grandPrixId })}>GP {gp.order}</a
										></Table.Cell
									><Table.Cell>{gp.era ?? '—'}</Table.Cell
									>{#each visiblePlayers as player (player.userId)}<Table.Cell
											class="text-right tabular-nums">{gp[metric][player.userId] ?? 0}</Table.Cell
										>{/each}</Table.Row
								>{/each}</Table.Body
						></Table.Root
					>
				</div>
			</details>
			<p class="text-muted-foreground mt-4 max-w-prose text-xs">
				GP wins include manually completed Grand Prix and shared first places. Race wins count
				first-place finishes in fully recorded races, including races in ongoing GPs.
			</p>
		</section>

		<section class="border-b py-8" aria-labelledby="players-heading">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 id="players-heading" class="font-title text-xl">Player comparison</h2>
					<p class="text-muted-foreground mt-2 text-sm">
						Wins, consistency, and points across all completed races.
					</p>
				</div>
				<label class="flex items-center gap-2 text-sm"
					>Sort by<select bind:value={ranking} class="bg-background rounded-md border px-3 py-2"
						><option value="wins">Race wins</option><option value="gpWins">GP wins</option><option
							value="races">Races</option
						><option value="winRate">Win rate</option><option value="podiums">Podiums</option
						><option value="average">Average finish</option><option value="points">Points</option
						></select
					></label
				>
			</div>
			<div class="bg-card mt-5 overflow-x-auto rounded-md border">
				<Table.Root
					><Table.Header
						><Table.Row
							><Table.Head>Player</Table.Head
							>{#each ['Races', 'GP wins', 'Race wins', 'Win %', 'Podiums', 'Podium %', 'Avg. finish', 'Points'] as heading (heading)}<Table.Head
									class="text-right whitespace-nowrap">{heading}</Table.Head
								>{/each}</Table.Row
						></Table.Header
					><Table.Body
						>{#each rankedPlayers as player (player.userId)}<Table.Row
								><Table.Cell class="font-medium"
									><a
										class="underline-offset-4 hover:underline focus-visible:ring-2"
										href={resolve('/players/[userId]', { userId: player.userId })}>{player.name}</a
									></Table.Cell
								>{#each [player.races, player.gpWins, player.wins, player.races ? `${player.winRate.toFixed(1)}%` : '—', player.podiums, player.races ? `${player.podiumRate.toFixed(1)}%` : '—', player.average?.toFixed(2) ?? '—', player.points.toLocaleString()] as value, index (index)}<Table.Cell
										class="text-right tabular-nums">{value}</Table.Cell
									>{/each}</Table.Row
							>{/each}</Table.Body
					></Table.Root
				>
			</div>
		</section>

		<div class="my-6 grid gap-6 lg:grid-cols-2">
			<section class="bg-card min-w-0 rounded-md border p-4 sm:p-6" aria-labelledby="rates-heading">
				<h2 id="rates-heading" class="font-title text-lg">Race win rate</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					First-place finishes as a percentage of races entered. Race counts in brackets.
				</p>
				<StatsBars data={winRates} label="Race win rate (%)" percent />
			</section>
			<section
				class="bg-card min-w-0 rounded-md border p-4 sm:p-6"
				aria-labelledby="points-heading"
			>
				<h2 id="points-heading" class="font-title text-lg">Average points per race</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Points earned divided by completed races entered. Higher is better; race counts in
					brackets.
				</p>
				<StatsBars data={averagePoints} label="Average points per race" />
			</section>
			<section
				class="bg-card min-w-0 rounded-md border p-4 sm:p-6"
				aria-labelledby="averages-heading"
			>
				<h2 id="averages-heading" class="font-title text-lg">Average finish</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Average finishing position across completed races. Lower is better; race counts in
					brackets.
				</p>
				<StatsBars data={averageFinishes} label="Average finish" />
			</section>
			<section
				class="bg-card min-w-0 rounded-md border p-4 sm:p-6"
				aria-labelledby="combos-heading"
			>
				<h2 id="combos-heading" class="font-title text-lg">Favourite combinations</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Top eight character / kart pairs by recorded uses in completed races.
				</p>
				<StatsBars
					data={stats.data.combos
						.slice(0, 8)
						.map((combo) => ({ name: combo.name, value: combo.count }))}
					label="Recorded uses"
				/>
			</section>
		</div>

		<section class="bg-card mb-6 rounded-md border p-4 sm:p-6" aria-labelledby="activity-heading">
			<h2 id="activity-heading" class="font-title text-xl">GP activity over time</h2>
			<p class="text-muted-foreground mt-2 text-sm">
				Grand Prix started each month, including ongoing GPs. Grouped by GP creation date in UTC;
				deleted GPs are excluded.
			</p>
			<Chart.Container
				config={activityConfig}
				class="mt-5 aspect-auto h-64 w-full"
				aria-label="Grand Prix started per month"
				><BarChart
					data={activity}
					x="label"
					y="gps"
					xScale={scaleBand().padding(0.2)}
					series={[{ key: 'gps', label: 'Grand Prix started', color: 'var(--chart-1)' }]}
					props={{
						bars: { stroke: 'none' },
						xAxis: {
							ticks: activity
								.filter((_, index, all) => index % Math.max(1, Math.ceil(all.length / 6)) === 0)
								.map((month) => month.label)
						}
					}}
					rule={false}
					>{#snippet tooltip()}<Chart.Tooltip
							labelFormatter={(_, payload) => `${payload[0]?.payload?.label ?? ''}`}
						/>{/snippet}</BarChart
				></Chart.Container
			>
			<details class="mt-3 text-sm">
				<summary
					class="text-muted-foreground focus-visible:outline-ring w-fit cursor-pointer rounded-sm focus-visible:outline-2"
					>View GP activity data</summary
				>
				<dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each activity as month (month.month)}<div>
							<dt>{month.label}</dt>
							<dd class="text-muted-foreground tabular-nums">{month.gps} Grand Prix started</dd>
						</div>{/each}
				</dl>
			</details>
		</section>
		<p class="text-muted-foreground max-w-prose border-t pt-5 text-sm">
			Race stats require a valid finish from 1–24 for every GP participant. Podiums are top-three
			finishes; points use Lapita’s scoring system. Average finish and rates have no minimum race
			count. Deleted Grand Prix are excluded. History reflects current results, so edits can change
			earlier totals.
		</p>
	{/if}
</main>
