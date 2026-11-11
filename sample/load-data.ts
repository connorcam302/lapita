import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));

export function validateLocalTarget(config: Record<string, string>): string {
	if (config.CONVEX_DEPLOY_KEY) {
		throw new Error('Use a local deployment env file without CONVEX_DEPLOY_KEY.');
	}
	const deployment = config.CONVEX_DEPLOYMENT;
	const url = config.CONVEX_SELF_HOSTED_URL;
	const adminKey = config.CONVEX_SELF_HOSTED_ADMIN_KEY;
	if (
		deployment &&
		!url &&
		!adminKey &&
		/^(local:[\w-]+|anonymous:anonymous-[\w-]+)$/.test(deployment)
	) {
		return deployment;
	}
	if (!deployment && url && adminKey) {
		const target = new URL(url);
		if (
			['http:', 'https:'].includes(target.protocol) &&
			['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
			!target.username &&
			!target.password
		) {
			return target.origin;
		}
	}
	throw new Error(
		'Expected a local or anonymous Convex deployment, or a loopback CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY. Run npm run dev:convex -- --local first.'
	);
}

function main() {
	const { values, positionals } = parseArgs({
		options: {
			'env-file': { type: 'string', default: '.env.local' },
			replace: { type: 'boolean' },
			yes: { type: 'boolean' },
			'dry-run': { type: 'boolean' },
			help: { type: 'boolean', short: 'h' }
		},
		allowPositionals: true
	});
	if (values.help) {
		console.log(`Usage: npm run load-data -- [snapshot.zip] [options]

Imports data-export/data-export.zip by default into a local Convex deployment.
Paths are relative to the project root.

  --env-file <path>  Local deployment configuration (default: .env.local)
  --replace          Replace data in the snapshot's tables (asks for confirmation)
  --yes              Skip replacement confirmation; requires --replace
  --dry-run          Validate configuration and snapshot without importing
  -h, --help         Show this help`);
		return;
	}
	if (positionals.length > 1) throw new Error('Provide at most one snapshot ZIP path.');
	if (values.yes && !values.replace) throw new Error('--yes requires --replace.');
	const snapshot = resolve(root, positionals[0] ?? 'data-export/data-export.zip');
	if (!snapshot.endsWith('.zip') || !statSync(snapshot).isFile()) {
		throw new Error('The snapshot must be a Convex export ZIP file.');
	}
	const envFile = resolve(root, values['env-file']);
	const target = validateLocalTarget(parse(readFileSync(envFile)));
	console.log(`Snapshot: ${snapshot}\nLocal target: ${target}`);
	console.log(values.replace ? 'Mode: replace imported tables' : 'Mode: import into empty tables');
	if (values['dry-run']) return;

	// An explicit env file keeps the CLI from selecting the active remote database.
	// Convex imports the snapshot as a whole, retaining document IDs and references.
	const cli = resolve(
		dirname(fileURLToPath(import.meta.resolve('convex/package.json'))),
		'bin/main.js'
	);
	const args = [cli, 'import', snapshot, '--env-file', envFile];
	if (values.replace) args.push('--replace');
	if (values.yes) args.push('--yes');
	const child = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
	if (child.error) throw child.error;
	process.exitCode = child.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
