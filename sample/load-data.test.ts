import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLocalTarget } from './load-data';

test('accepts a Convex local deployment', () => {
	assert.equal(validateLocalTarget({ CONVEX_DEPLOYMENT: 'local:lapita-dev' }), 'local:lapita-dev');
});

test('accepts an anonymous local deployment', () => {
	assert.equal(
		validateLocalTarget({ CONVEX_DEPLOYMENT: 'anonymous:anonymous-lapita' }),
		'anonymous:anonymous-lapita'
	);
});

test('accepts loopback self-hosted deployments', () => {
	for (const host of ['localhost', '127.0.0.1', '[::1]']) {
		const url = `http://${host}:3210`;
		assert.equal(
			validateLocalTarget({
				CONVEX_SELF_HOSTED_URL: url,
				CONVEX_SELF_HOSTED_ADMIN_KEY: 'test-key'
			}),
			url
		);
	}
});

test('rejects remote, ambiguous, and incomplete targets', () => {
	for (const config of [
		{},
		{ PUBLIC_CONVEX_URL: 'https://example.convex.cloud' },
		{ CONVEX_DEPLOYMENT: 'dev:lapita' },
		{ CONVEX_DEPLOYMENT: 'prod:lapita' },
		{ CONVEX_DEPLOYMENT: 'local:lapita', CONVEX_DEPLOY_KEY: 'test-key' },
		{ CONVEX_DEPLOYMENT: 'local:lapita', CONVEX_SELF_HOSTED_URL: 'http://localhost:3210' },
		{ CONVEX_SELF_HOSTED_URL: 'http://localhost:3210' },
		{ CONVEX_SELF_HOSTED_URL: 'https://remote.example', CONVEX_SELF_HOSTED_ADMIN_KEY: 'test-key' },
		{
			CONVEX_SELF_HOSTED_URL: 'http://localhost.example:3210',
			CONVEX_SELF_HOSTED_ADMIN_KEY: 'test-key'
		}
	]) {
		assert.throws(() => validateLocalTarget(config as Record<string, string>));
	}
});
