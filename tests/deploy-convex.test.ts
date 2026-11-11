import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const script = resolve('scripts/deploy-convex.sh');

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), 'lapita-deploy-test-'));
	const secret = join(directory, 'admin-key');
	const calls = join(directory, 'calls');
	writeFileSync(secret, 'test-only-admin-key\n');
	writeFileSync(
		join(directory, 'bun'),
		`#!/bin/sh
printf '%s\\n' "$@" > "$TEST_CALLS"
printf '%s\\n' "$CONVEX_SELF_HOSTED_URL" >> "$TEST_CALLS"
[ "$CONVEX_SELF_HOSTED_ADMIN_KEY" = 'test-only-admin-key' ] || exit 91
[ -z "\${CONVEX_DEPLOY_KEY+x}" ] || exit 92
[ -z "\${CONVEX_DEPLOYMENT+x}" ] || exit 93
exit "\${TEST_DEPLOY_EXIT:-0}"
`,
		{ mode: 0o700 }
	);
	return {
		secret,
		calls,
		run(overrides: Record<string, string> = {}) {
			return spawnSync('sh', [script], {
				encoding: 'utf8',
				env: {
					PATH: `${directory}:${process.env.PATH}`,
					DEPLOY_CONVEX: 'true',
					PUBLIC_CONVEX_URL: 'https://convex.example.com',
					CONVEX_ADMIN_KEY_FILE: secret,
					TEST_CALLS: calls,
					// Simulate inherited local/cloud configuration: it must not choose the target.
					CONVEX_DEPLOY_KEY: 'wrong-deploy-key',
					CONVEX_DEPLOYMENT: 'dev:wrong-deployment',
					CONVEX_SELF_HOSTED_URL: 'https://wrong-backend.example.com',
					...overrides
				}
			});
		},
		cleanup: () => rmSync(directory, { recursive: true, force: true })
	};
}

test('website-only builds skip deployment without requiring credentials', () => {
	const f = fixture();
	try {
		for (const DEPLOY_CONVEX of ['', 'false']) {
			const result = f.run({ DEPLOY_CONVEX, CONVEX_ADMIN_KEY_FILE: '/missing' });
			assert.equal(result.status, 0);
			assert.match(result.stdout, /Skipping Convex deployment/);
			assert.equal(existsSync(f.calls), false);
		}
	} finally {
		f.cleanup();
	}
});

test('invalid flags, missing URLs and missing/empty secrets fail before invoking the CLI', () => {
	const f = fixture();
	try {
		const invalidConfigurations: Record<string, string>[] = [
			{ DEPLOY_CONVEX: 'yes' },
			{ PUBLIC_CONVEX_URL: '' },
			{ CONVEX_ADMIN_KEY_FILE: '/missing' }
		];
		for (const overrides of invalidConfigurations) {
			assert.equal(f.run(overrides).status, 1);
			assert.equal(existsSync(f.calls), false);
		}
		for (const secret of ['', '\n']) {
			writeFileSync(f.secret, secret);
			assert.equal(f.run().status, 1);
			assert.equal(existsSync(f.calls), false);
		}
	} finally {
		f.cleanup();
	}
});

test('deploys to the frontend backend using the mounted key and installed CLI', () => {
	const f = fixture();
	try {
		const result = f.run();
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(readFileSync(f.calls, 'utf8').trim().split('\n'), [
			'run',
			'convex',
			'deploy',
			'--codegen',
			'disable',
			'https://convex.example.com'
		]);
		assert.doesNotMatch(result.stdout + result.stderr, /test-only-admin-key|wrong-deploy-key/);
	} finally {
		f.cleanup();
	}
});

test('deployment errors propagate to fail the Docker build', () => {
	const f = fixture();
	try {
		assert.equal(f.run({ TEST_DEPLOY_EXIT: '42' }).status, 42);
	} finally {
		f.cleanup();
	}
});
