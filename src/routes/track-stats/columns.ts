import { renderComponent, renderSnippet } from '$lib/components/ui/data-table';
import type { ColumnDef } from '@tanstack/table-core';
import { createRawSnippet } from 'svelte';
import SortableHeader from './SortableHeader.svelte';
import type { Id } from '../../convex/_generated/dataModel';
import { getPositionColour } from '$lib/utils';

export type Columns = {
	trackImage: string;
	trackName: string;
	count: number;
	average: number;
	bestPlayerName: string;
	bestAverage: number;
	bestPlayerId: Id<'users'>;
	gap: number;
};

export const columns: ColumnDef<Columns>[] = [
	{
		accessorKey: 'trackName',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Track',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		},
		cell: ({ row }) => {
			const amountCellSnippet = createRawSnippet<[string]>(() => {
				return {
					render: () =>
						`<div class='flex gap-4 items-center'><img src="/tracks/icons/${row.original.trackImage}.png" alt="${row.getValue('trackName')}" class='w-10' /><span class='text-lg'>${row.getValue('trackName')}</div></div>`
				};
			});

			return renderSnippet(amountCellSnippet);
		}
	},

	{
		accessorKey: 'count',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Count',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		}
	},
	{
		accessorKey: 'average',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Average',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		},
		cell: ({ row }) => {
			const amountCellSnippet = createRawSnippet<[string]>(() => {
				return {
					render: () =>
						`<div class="flex w-20 justify-center items-center mx-auto rounded-sm text-center text-lg text-black"
											style="background-color: ${getPositionColour(row.getValue('average'))}">${row.getValue('average').toFixed(2)}</div>`
				};
			});

			return renderSnippet(amountCellSnippet);
		}
	},
	{
		accessorKey: 'bestPlayerName',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Best Player',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		},
		cell: ({ row }) => {
			const amountCellSnippet = createRawSnippet<[string]>(() => {
				return {
					render: () =>
						`<a href="/players/${row.original.bestPlayerId}" class="font-semibold hover:text-zinc-400 duration-200">${row.getValue('bestPlayerName')}</a>`
				};
			});

			return renderSnippet(amountCellSnippet);
		}
	},
	{
		accessorKey: 'bestAverage',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Best Average',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		},
		cell: ({ row }) => {
			const amountCellSnippet = createRawSnippet<[string]>(() => {
				return {
					render: () =>
						`<div class="flex w-20 justify-center items-center mx-auto rounded-sm text-center text-lg text-black"
											style="background-color: ${getPositionColour(row.getValue('bestAverage'))}">${row.getValue('bestAverage').toFixed(2)}</div>`
				};
			});

			return renderSnippet(amountCellSnippet);
		}
	},
	{
		accessorKey: 'gap',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Gap',
				onclick: column.getToggleSortingHandler()
			}),
		meta: {
			align: 'center'
		},
		cell: ({ row }) => {
			return row.getValue('gap').toFixed(3);
		}
	}
];
