import { useConvexClient } from 'convex-svelte';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { QueryResource, type QueryState } from './query-resource';

/** Subscribe once per argument set; retries preserve form state and any available data. */
export function useRecoverableQuery<Q extends FunctionReference<'query'>>(
	query: Q,
	args: FunctionArgs<Q> | (() => FunctionArgs<Q> | 'skip')
) {
	const client = useConvexClient();
	let state = $state.raw<QueryState<FunctionReturnType<Q>>>({
		data: undefined,
		error: false,
		isLoading: true
	});
	let resource: QueryResource<FunctionReturnType<Q>> | undefined;
	$effect(() => {
		const values = typeof args === 'function' ? (args as () => FunctionArgs<Q> | 'skip')() : args;
		state = { data: undefined, error: false, isLoading: values !== 'skip' };
		if (values === 'skip') {
			resource = undefined;
			return;
		}
		const current = new QueryResource<FunctionReturnType<Q>>(
			(success, failure) => client.onUpdate(query, values, success, failure),
			(value) => {
				state = value;
			}
		);
		resource = current;
		current.start();
		return () => {
			current.stop();
		};
	});
	return {
		get data() {
			return state.data;
		},
		get error() {
			return state.error;
		},
		get isLoading() {
			return state.isLoading;
		},
		retry() {
			resource?.start();
		}
	};
}
