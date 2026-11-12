<script lang="ts">
	let { scope }: { scope: 'player' | 'stats' | 'records' | 'track' | 'gp' | 'rivalry' } = $props();
	const descriptions = {
		player:
			'Race totals, wins and averages use your recorded finishes, including partially recorded races.',
		stats:
			'Race totals, wins, points and averages use fully recorded races, including those in ongoing GPs.',
		records: 'Race records use fully recorded races. GP records use completed GPs.',
		track:
			'Performance uses recorded finishes. Scheduled counts include races with missing results; transitions count by end track.',
		gp: 'Points include each recorded finish, even in partially recorded races.',
		rivalry:
			'Only races where both selected players entered with a recorded finish count. Other racers may still have missing results.'
	};
</script>

<div class="text-muted-foreground my-4 text-sm">
	<p>{descriptions[scope]}</p>
	<details class="mt-2 max-w-prose">
		<summary
			class="focus-visible:ring-ring w-fit cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2"
		>
			How statistics are counted
		</summary>
		<dl class="mt-3 space-y-2 text-xs">
			{#if scope === 'rivalry'}
				<div>
					<dt class="text-foreground inline font-medium">Head-to-head percentage:</dt>
					<dd class="inline">
						Finishes ahead ÷ shared races × 100. Equal finishes are ties: neither player earns a
						win, and ties stay in the denominator, so percentages may total less than 100%.
					</dd>
				</div>
				<div>
					<dt class="text-foreground inline font-medium">Shared sample:</dt>
					<dd class="inline">
						Average finish and Lapita points use those same shared races. Lower average finishes are
						better. Points use each recorded position, including equal points for tied finishes; GP
						standings do not affect this comparison.
					</dd>
				</div>
			{/if}
			<div>
				<dt class="text-foreground inline font-medium">Scheduled race:</dt>
				<dd class="inline">A race on a GP’s schedule, whether or not results have been entered.</dd>
			</div>
			<div>
				<dt class="text-foreground inline font-medium">Recorded finish:</dt>
				<dd class="inline">
					One racer’s integer position from 1–24. Missing and invalid positions do not count.
				</dd>
			</div>
			<div>
				<dt class="text-foreground inline font-medium">Fully recorded race:</dt>
				<dd class="inline">
					Every GP participant has a recorded finish. Manual GP completion does not fill missing
					results.
				</dd>
			</div>
			<div>
				<dt class="text-foreground inline font-medium">Completed GP:</dt>
				<dd class="inline">
					A GP with racers and scheduled races, where every race is fully recorded or the GP was
					manually marked complete. Manual completion uses recorded points; missing finishes earn
					zero. Tied leaders each receive a GP win. Results remain editable.
				</dd>
			</div>
			{#if scope === 'player'}
				<div>
					<dt class="text-foreground inline font-medium">Personal records:</dt>
					<dd class="inline">
						Use the Records rules, so podium and streak totals can exclude finishes counted in your
						overview. Stats also excludes partially recorded races.
					</dd>
				</div>
			{:else if scope === 'stats' || scope === 'records'}
				<div>
					<dt class="text-foreground inline font-medium">Player profiles and tracks:</dt>
					<dd class="inline">
						Include individual recorded finishes from partially recorded races, so totals can differ
						from this page.
					</dd>
				</div>
			{/if}
			<div>
				<dt class="text-foreground inline font-medium">Wins and podiums:</dt>
				<dd class="inline">
					Race wins require 1st place; podiums require a top-three finish. These are finishing
					positions in the full field, not ranks within the group. Lower average finishes are
					better.
				</dd>
			</div>
			<div>
				<dt class="text-foreground inline font-medium">History:</dt>
				<dd class="inline">
					Deleted GPs are excluded. Editing results can change earlier statistics.
				</dd>
			</div>
		</dl>
	</details>
</div>
