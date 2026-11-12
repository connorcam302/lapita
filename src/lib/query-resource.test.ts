import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryResource, type Subscribe, type QueryState } from './query-resource';

function harness<T>(timeout = 1000) {
	const attempts: { success: (data: T) => void; fail: () => void; closed: boolean }[] = [];
	let state: QueryState<T>;
	const subscribe: Subscribe<T> = (success, fail) => {
		const attempt = { success, fail, closed: false };
		attempts.push(attempt);
		return () => {
			attempt.closed = true;
		};
	};
	const resource = new QueryResource(
		subscribe,
		(value) => {
			state = value;
		},
		timeout
	);
	return {
		resource,
		attempts,
		get state() {
			return state;
		}
	};
}

test('query errors end loading and retry can recover with an empty result', () => {
	const h = harness<string[]>();
	h.resource.start();
	h.attempts[0].fail();
	assert.equal(h.state.isLoading, false);
	assert.equal(h.state.error, true);
	h.resource.start();
	assert.equal(h.attempts[0].closed, true);
	assert.equal(h.state.error, false);
	h.attempts[1].success([]);
	assert.deepEqual(h.state, { data: [], error: false, isLoading: false });
	h.resource.stop();
});

test('stale responses after retry and unmount cannot overwrite the current result', () => {
	const h = harness<string>();
	h.resource.start();
	h.resource.start();
	h.attempts[1].success('current GP');
	h.attempts[0].success('previous GP');
	h.attempts[0].fail();
	assert.equal(h.state.data, 'current GP');
	assert.equal(h.state.error, false);
	h.resource.stop();
	h.attempts[1].fail();
	assert.equal(h.state.error, false);
});

test('refresh errors retain available content while retrying', () => {
	const h = harness<number[]>();
	h.resource.start();
	h.attempts[0].success([15, 12]);
	h.attempts[0].fail();
	assert.deepEqual(h.state.data, [15, 12]);
	h.resource.start();
	assert.deepEqual(h.state.data, [15, 12]);
	h.attempts[1].success([15, 15]);
	assert.deepEqual(h.state.data, [15, 15]);
	h.resource.stop();
});

test('a disconnected query times out and recovers when the subscription reconnects', (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const h = harness<string>(15000);
	h.resource.start();
	t.mock.timers.tick(15000);
	assert.equal(h.state.error, true);
	assert.equal(h.state.isLoading, false);
	assert.equal(h.attempts[0].closed, false);
	h.attempts[0].success('reconnected');
	assert.equal(h.state.error, false);
	assert.equal(h.state.data, 'reconnected');
	h.resource.stop();
});

test('synchronous subscription failures are recoverable and disposal cancels timeout', (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let state: QueryState<string> | undefined;
	const resource = new QueryResource<string>(
		() => {
			throw new Error('private details');
		},
		(value) => {
			state = value;
		}
	);
	resource.start();
	assert.deepEqual(state, { data: undefined, error: true, isLoading: false });
	resource.stop();
	t.mock.timers.tick(30000);
	assert.equal(state?.error, true);
});

test('server reads time out and release their timer after success or failure', async (t) => {
	const { readWithTimeout } = await import('./query-resource');
	t.mock.timers.enable({ apis: ['setTimeout'] });
	assert.equal(await readWithTimeout(Promise.resolve('ready')), 'ready');
	await assert.rejects(readWithTimeout(Promise.reject(new Error('failed'))), /failed/);
	const waiting = readWithTimeout(new Promise<never>(() => {}));
	const rejected = assert.rejects(waiting, /Read timed out/);
	t.mock.timers.tick(15000);
	await rejected;
});
