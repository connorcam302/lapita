#!/bin/sh
set -eu

case "${DEPLOY_CONVEX:-false}" in
	false) echo 'Skipping Convex deployment (DEPLOY_CONVEX=false).'; exit 0 ;;
	true) ;;
	*) echo 'DEPLOY_CONVEX must be true or false.' >&2; exit 1 ;;
esac

if [ -z "${PUBLIC_CONVEX_URL:-}" ]; then
	echo 'PUBLIC_CONVEX_URL is required for Convex deployment.' >&2
	exit 1
fi

key_file="${CONVEX_ADMIN_KEY_FILE:-/run/secrets/CONVEX_SELF_HOSTED_ADMIN_KEY}"
if [ ! -s "$key_file" ]; then
	echo 'Provide the CONVEX_SELF_HOSTED_ADMIN_KEY build secret to deploy Convex.' >&2
	exit 1
fi

# Always deploy to the backend embedded in the website being built.
unset CONVEX_DEPLOYMENT CONVEX_DEPLOY_KEY
export CONVEX_SELF_HOSTED_URL="$PUBLIC_CONVEX_URL"
CONVEX_SELF_HOSTED_ADMIN_KEY="$(cat "$key_file")"
export CONVEX_SELF_HOSTED_ADMIN_KEY
if [ -z "$CONVEX_SELF_HOSTED_ADMIN_KEY" ]; then
	echo 'The CONVEX_SELF_HOSTED_ADMIN_KEY build secret is empty.' >&2
	exit 1
fi

# Use the locked, installed CLI and committed bindings. A failed push fails the build.
exec bun run convex deploy --codegen disable
