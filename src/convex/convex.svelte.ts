import { browser } from '$app/environment';
import { useConvexClient } from 'convex-svelte';
import { ConvexClient } from 'convex/browser';
import {
	type FunctionReference,
	type FunctionArgs,
	type FunctionReturnType,
	type PaginationResult,
	type DefaultFunctionArgs
} from 'convex/server';

type UseQueryOptions<Query extends FunctionReference<'query'>> = {
	initialData?: FunctionReturnType<Query>;
	keepPreviousData?: boolean;
	enabled?: boolean;
	onUpdate?: () => void;
};

type MaybeGetter<T> = T | (() => T);

abstract class ConvexQueryBase<Query extends FunctionReference<'query', 'public'>> {
	static get = <T>(v: MaybeGetter<T>): T => {
		if (typeof v === 'function') {
			return (v as () => T)();
		}
		return v;
	};

	protected query: MaybeGetter<Query>;
	protected args: MaybeGetter<FunctionArgs<Query>>;
	protected options: MaybeGetter<UseQueryOptions<Query>> = {};

	protected client: ConvexClient;

	protected loading = $state(false);
	protected currentError = $state<Error | undefined>(undefined);
	protected enabled = $derived(ConvexQueryBase.get(this.options).enabled !== false);

	constructor(
		query: MaybeGetter<Query>,
		args: MaybeGetter<FunctionArgs<Query>>,
		options: MaybeGetter<UseQueryOptions<Query>> = {}
	) {
		this.query = query;
		this.args = args;
		this.options = options;
		this.client = useConvexClient();
	}

	// Méthode abstraite pour les données, à implémenter par les sous-classes
	abstract get data(): FunctionReturnType<Query> | undefined;

	get isLoading() {
		return this.loading;
	}

	get error() {
		return this.currentError;
	}

	get isEnabled() {
		return this.enabled;
	}

	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	protected handleUpdate(data: FunctionReturnType<Query> | undefined): void {
		this.loading = false;
		ConvexQueryBase.get(this.options).onUpdate?.();
	}

	protected handleError(error: Error): void {
		this.currentError = error;
		this.loading = false;
	}
}

/**
 * A wrapper class for Convex queries that integrates with Svelte's reactivity system.
 *
 * This class provides a reactive interface to Convex queries, automatically updating
 * when arguments or dependencies change, and handling loading states and errors.
 *
 * @example Basic usage:
 * ```typescript
 * // Get a specific member by ID
 * const userQuery = new ConvexQuery(
 *   api.user.get,
 *   () => ({ id: userId })
 * );
 *
 * // Access the data with memberQuery.data
 * let user = $derived(userQuery.data);
 * ```
 *
 * @example With conditional querying:
 * ```typescript
 * // Search for users with a specific name
 *
 * let searchValue = $state('');
 *
 * const searchQuery = new ConvexQuery(
 *   api.user.search,
 *   () => ({ searchFullName: searchValue }),
 *   () => ({
 *     enabled: searchValue.length > 2
 *   })
 * );
 * ```
 *
 * @example With initial data and previous data retention:
 * ```typescript
 * const userQuery = new ConvexQuery(
 *   api.user.get,
 *   () => ({ id: userId }),
 *   () => ({
 *     initialData: cachedUser,
 *     keepPreviousData: true,
 *     onUpdate: () => console.log('Data updated')
 *   })
 * );
 * ```
 */
export class ConvexQuery<
	Query extends FunctionReference<'query', 'public'>
> extends ConvexQueryBase<Query> {
	protected currentData = $state<FunctionReturnType<Query> | undefined>(undefined);

	constructor(
		query: MaybeGetter<Query>,
		args: MaybeGetter<FunctionArgs<Query>>,
		options: MaybeGetter<UseQueryOptions<Query>> = {}
	) {
		super(query, args, options);
		this.currentData = ConvexQueryBase.get(this.options).initialData;

		$effect(() => {
			if (!browser || !this.isEnabled) {
				this.currentData = undefined;
				this.loading = false;
				this.currentError = undefined;
				return;
			}

			this.loading = !ConvexQueryBase.get(this.options).keepPreviousData;
			this.currentError = undefined;

			if (!ConvexQueryBase.get(this.options).keepPreviousData) {
				this.currentData = undefined;
			}

			const unsubscribe = this.client.onUpdate(
				ConvexQueryBase.get(this.query),
				ConvexQueryBase.get(this.args),
				(data) => {
					this.currentData = data;
					this.handleUpdate(data);
				},
				(error) => this.handleError(error)
			);

			return unsubscribe;
		});
	}

	get data() {
		return this.currentData;
	}
}

/**
 * A specialized wrapper for paginated Convex queries that automatically handles
 * loading multiple pages of data and provides access to both the current page
 * and accumulated results.
 *
 * This class manages pagination state, tracking cursors and loading additional
 * pages when requested, while maintaining the full result set.
 *
 * @example Basic usage with search:
 * ```typescript
 * // List users with pagination and search filtering
 * const usersQuery = new ConvexQueryPaginated(
 *   api.user.search,
 *   () => ({ searchFullName: debouncedSearch.current }),
 *   30 // Page size,
 *   () => enabled
 * );
 *
 * // Access all accumulated results
 * let users = $derived(usersQuery.result);
 *
 * // Check if all pages have been loaded
 * let allLoaded = $derived(usersQuery.isDone);
 * ```
 *
 * @example Using the loadMore function:
 * ```typescript
 * // In a button click handler or intersection observer callback:
 * function loadMoreItems() {
 *   if (!usersQuery.isDone && !usersQuery.isLoading) {
 *     usersQuery.loadMore();
 *   }
 * }
 * ```
 */

export class ConvexQueryPaginated<
	Query extends FunctionReference<'query', 'public', DefaultFunctionArgs, PaginationResult<D>>,
	D = FunctionReturnType<Query> extends PaginationResult<infer T> ? T : never
> {
	private client: ConvexClient;

	protected query: MaybeGetter<Query>;
	protected args: MaybeGetter<FunctionArgs<Query>>;
	protected pageSize: MaybeGetter<number>;
	protected enabled: MaybeGetter<boolean> = true;

	protected paginatedQuery = $state<PaginatedQuery<Query, D> | undefined>();

	protected isDisabled = $derived(ConvexQueryBase.get(this.enabled) === false);

	constructor(
		query: MaybeGetter<Query>,
		args: MaybeGetter<Omit<FunctionArgs<Query>, 'paginationOpts'>>,
		pageSize: MaybeGetter<number> = 30,
		enabled: MaybeGetter<boolean> = true
	) {
		this.query = query;
		this.args = args;
		this.pageSize = pageSize;
		this.enabled = enabled;

		this.client = useConvexClient();

		$effect(() => {
			if (this.isDisabled) {
				return;
			}

			const newQuery = new PaginatedQuery(
				this.client,
				ConvexQueryBase.get(this.query),
				ConvexQueryBase.get(this.args),
				ConvexQueryBase.get(this.pageSize)
			);

			this.paginatedQuery = newQuery;

			setTimeout(() => this.paginatedQuery?.loadMore(), 0);

			return newQuery.unsubscribe();
		});

		$effect(() => {
			if (this.isDisabled) {
				this.paginatedQuery = undefined;
			}
		});
	}

	result = $derived(this.paginatedQuery?.result);
	isLoading = $derived(this.paginatedQuery?.isLoading);
	isDone = $derived(this.isDisabled ? true : this.paginatedQuery?.isDone);
	isEnabled = $derived(!this.isDisabled);

	loadMore = $derived(this.paginatedQuery?.loadMore);

	error = $derived(this.paginatedQuery?.error);
}

class PaginatedQuery<
	Query extends FunctionReference<'query', 'public', DefaultFunctionArgs, PaginationResult<D>>,
	D = FunctionReturnType<Query> extends PaginationResult<infer T> ? T : never
> {
	pages = $state<Record<number, D[]>>({});
	unsubscribes = $state<Record<number, ReturnType<typeof this.client.onUpdate>>>({});
	loading = $state<Record<number, boolean>>({});

	private currentError = $state<Error | undefined>(undefined);

	private client: ConvexClient;
	private pageSize: number;
	private _isDone = $state(false);

	private currentPage = $state(0);

	private query: Query;
	private args: Omit<FunctionArgs<Query>, 'paginationOpts'>;

	private cursor: string | null = null;

	constructor(
		client: ConvexClient,
		query: Query,
		args: Omit<FunctionArgs<Query>, 'paginationOpts'>,
		pageSize: number = 1
	) {
		this.client = client;
		this.pageSize = pageSize;
		this.query = query;
		this.args = args;

		this.loadNext();
	}

	loadNext = () => {
		this.currentPage++;
		this.loadPage($state.snapshot(this.currentPage), this.cursor, null);
	};

	loadPage = (queryPage: number, cursor: string | null, endCursor: string | null) => {
		this.loading[queryPage] = true;
		this.unsubscribes[queryPage] = this.client.onUpdate(
			this.query,
			{
				...this.args,
				paginationOpts: {
					cursor,
					numItems: this.pageSize,
					endCursor
				}
			},
			(data) => {
				this.loading[queryPage] = false;

				if (data.splitCursor) {
					this.unsubscribes[queryPage]();

					this.loadPage(queryPage, cursor, data.splitCursor);
					this.loadPage(queryPage + 0.5, data.splitCursor, data.continueCursor);
					return;
				}

				this.pages[queryPage] = data.page;

				if (queryPage === Math.max(...Object.keys(this.pages).map(Number))) {
					this._isDone = data.isDone;
					this.cursor = data.continueCursor;
				}
			},
			(error) => {
				this.currentError = error;
				this.loading[queryPage] = false;
			}
		);
	};

	get isDone() {
		return this._isDone;
	}

	get result() {
		return Object.values(this.pages).flat();
	}

	get isLoading() {
		return Object.values(this.loading).some((loading) => loading);
	}

	loadMore = () => {
		if (!this._isDone) {
			this.loadNext();
		}
	};

	unsubscribe = () => {
		this.pages = {};
		this.loading = {};

		Object.values(this.unsubscribes).forEach((unsubscribe) => unsubscribe());
	};

	get error() {
		return this.currentError;
	}
}
