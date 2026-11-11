import { renderComponent } from '$lib/components/ui/data-table';
import type { ColumnDef } from '@tanstack/table-core';
import TrackLink from './TrackLink.svelte';
import PlayerLink from './PlayerLink.svelte';
import SortableHeader from './SortableHeader.svelte';
import type { Id } from '../../convex/_generated/dataModel';
import AverageFinish from './AverageFinish.svelte';

export type Columns = {
	trackId: Id<'tracks'>;
	trackImage: string;
	trackName: string;
	count: number;
	average: number | null;
	bestPlayerName: string;
	bestAverage: number | null;
	bestPlayerId: Id<'users'> | null;
	gap: number | null;
};

export const columns: ColumnDef<Columns>[] = [
	{
		accessorKey: 'trackName',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Track',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) =>
			renderComponent(TrackLink, {
				trackId: row.original.trackId,
				trackImage: row.original.trackImage,
				trackName: row.original.trackName
			})
	},

	{
		accessorKey: 'count',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Races',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.count.toLocaleString()
	},
	{
		accessorKey: 'average',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Avg. racers',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => row.original.average?.toFixed(2) ?? '—'
	},
	{
		accessorKey: 'bestPlayerName',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Leading player',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) =>
			renderComponent(PlayerLink, {
				userId: row.original.bestPlayerId,
				name: row.original.bestPlayerName
			})
	},
	{
		accessorKey: 'bestAverage',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Avg. finish',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => renderComponent(AverageFinish, { value: row.original.bestAverage })
	},
	{
		accessorKey: 'gap',
		header: ({ column }) =>
			renderComponent(SortableHeader, {
				label: 'Lead gap',
				sorted: column.getIsSorted(),
				onclick: column.getToggleSortingHandler()
			}),
		cell: ({ row }) => {
			return row.original.gap?.toFixed(3) ?? '—';
		}
	}
];
