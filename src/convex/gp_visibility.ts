import type { QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

/** Keep retained races and standings out of normal views while their GP is deleted. */
export async function activeGpRows<T extends { grandPrixId: Id<'grandPrix'> }>(
	ctx: Pick<QueryCtx, 'db'>,
	rows: T[]
): Promise<T[]> {
	const gps = await Promise.all(
		[...new Set(rows.map((row) => row.grandPrixId))].map((id) => ctx.db.get(id))
	);
	const active = new Set(gps.filter((gp) => gp && gp.deletedAt === undefined).map((gp) => gp!._id));
	return rows.filter((row) => active.has(row.grandPrixId));
}
