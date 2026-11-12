<script lang="ts">
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { ConvexError } from 'convex/values';
	import { toast } from 'svelte-sonner';
	import { api } from '../../../convex/_generated/api';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	let { order, era = '' }: { order?: number; era?: string } = $props();
	const uid = $props.id();
	const client = useConvexClient();
	const options = useQuery(api.gps.eraOptions, {});
	let open = $state(false);
	let saving = $state(false);
	let from = $state<number | undefined>();
	let to = $state<number | undefined>();
	let name = $state('');
	let error = $state('');
	const valid = $derived(
		Number.isSafeInteger(from) && Number.isSafeInteger(to) && from! >= 1 && to! >= from!
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (saving || !valid) return;
		saving = true;
		error = '';
		try {
			const count = await client.mutation(api.gps.setEra, { from: from!, to: to!, era: name });
			open = false;
			toast.success(`${name.trim() ? 'Era saved for' : 'Era removed from'} ${count} Grand Prix.`);
		} catch (cause) {
			error =
				cause instanceof ConvexError
					? String(cause.data)
					: 'Could not save the era. Your entries have been kept. Try again.';
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(value) => {
		if (value) {
			from = order;
			to = order;
			name = era;
			error = '';
		}
	}}
>
	<Dialog.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
		{order ? 'Edit era' : 'Tag GP era'}
	</Dialog.Trigger>
	<Dialog.Content
		showCloseButton={!saving}
		onInteractOutside={(event) => {
			if (saving) event.preventDefault();
		}}
		onEscapeKeydown={(event) => {
			if (saving) event.preventDefault();
		}}
	>
		<Dialog.Header>
			<Dialog.Title>Tag a Grand Prix era</Dialog.Title>
			<Dialog.Description
				>Give a GP or range a shared name, such as Dixie Dean Arc for GPs 4–8. Each GP has one era.</Dialog.Description
			>
		</Dialog.Header>
		<form onsubmit={save} class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for={`${uid}-from`} class="mb-2 block text-sm font-medium">First GP</label><Input
						id={`${uid}-from`}
						type="number"
						min="1"
						step="1"
						required
						bind:value={from}
						disabled={saving}
					/>
				</div>
				<div>
					<label for={`${uid}-to`} class="mb-2 block text-sm font-medium">Last GP</label><Input
						id={`${uid}-to`}
						type="number"
						min={from ?? 1}
						step="1"
						required
						bind:value={to}
						disabled={saving}
					/>
				</div>
			</div>
			<div>
				<label for={`${uid}-name`} class="mb-2 block text-sm font-medium">Era name</label>
				<Input
					id={`${uid}-name`}
					list={`${uid}-eras`}
					maxlength={80}
					placeholder="Dixie Dean Arc"
					bind:value={name}
					disabled={saving}
					aria-describedby={`${uid}-help`}
				/>
				<datalist id={`${uid}-eras`}
					>{#each options.data ?? [] as option (option)}<option value={option}
						></option>{/each}</datalist
				>
				<p id={`${uid}-help`} class="text-muted-foreground mt-2 text-sm">
					Saving replaces the era on existing, available GPs in this inclusive range. Leave the name
					blank to remove their tags. Future GPs are not included.
				</p>
			</div>
			{#if error}<p role="alert" class="text-destructive text-sm">{error}</p>{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" disabled={saving} onclick={() => (open = false)}
					>Cancel</Button
				>
				<Button type="submit" variant="secondary" disabled={saving || !valid}
					>{saving ? 'Saving…' : name.trim() ? 'Save era' : 'Remove era'}</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
