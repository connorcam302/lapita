/** Read-only requests keep listening after a timeout so reconnecting can recover automatically. */
export type QueryState<T> = { data: T | undefined; error: boolean; isLoading: boolean };
export type Subscribe<T> = (success: (data: T) => void, failure: () => void) => () => void;

export class QueryResource<T> {
	state: QueryState<T> = { data: undefined, error: false, isLoading: true };
	private generation = 0;
	private cleanup?: () => void;
	private timer?: ReturnType<typeof setTimeout>;

	constructor(
		private subscribe: Subscribe<T>,
		private changed: (state: QueryState<T>) => void,
		private timeoutMs = 15000
	) {}

	private publish(update: Partial<QueryState<T>>) {
		this.state = { ...this.state, ...update };
		this.changed(this.state);
	}

	start() {
		this.stop();
		const generation = this.generation;
		this.publish({ error: false, isLoading: true });
		const failure = () => {
			if (generation !== this.generation) return;
			clearTimeout(this.timer);
			this.publish({ error: true, isLoading: false });
		};
		this.timer = setTimeout(failure, this.timeoutMs);
		try {
			this.cleanup = this.subscribe((data) => {
				if (generation !== this.generation) return;
				clearTimeout(this.timer);
				this.publish({ data, error: false, isLoading: false });
			}, failure);
		} catch {
			failure();
		}
	}

	stop() {
		this.generation++;
		clearTimeout(this.timer);
		this.cleanup?.();
		this.cleanup = undefined;
	}
}

/** Bound server-loader reads as well as browser subscriptions. */
export async function readWithTimeout<T>(request: Promise<T>, timeoutMs = 15000): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			request,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('Read timed out')), timeoutMs);
			})
		]);
	} finally {
		clearTimeout(timer);
	}
}
