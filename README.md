# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Dependency maintenance

Use Node.js 22.13 or newer on the 22.x line, or Node.js 24+, and Bun 1.3.4
(the version used by the Dockerfile). Install the committed lockfile with
`bun install --frozen-lockfile`.

The dependency refresh uses Vite 8, TypeScript 6, ESLint 10, Svelte 5, Tailwind 4,
and stable LayerChart 2. Charts use LayerChart's `ChartState` and tooltip series API.
SvelteKit stays on the latest 2.x release with adapter-node 5; SvelteKit 3 requires
an application migration. TanStack Table stays on 8.x because v9 changes its API.
TypeScript stays on 6.x to match the SvelteKit and typescript-eslint peer ranges.
Node typings stay on 22.x to match the Docker runtime.

Run these checks after dependency changes:

```bash
bun run build
bun run check
bun run lint
bun run tsx --test sample/load-data.test.ts
bun audit
```

The app already has type, formatting, and lint errors, so compare diagnostics
with the pre-upgrade baseline. The refresh removes the critical and high audit
findings, but six findings remain: a moderate minimatch issue in lint tooling,
a moderate selector-parser issue pinned by the typography plugin, and four low
findings in SvelteKit 2, cookie, and deepmerge. Clearing these requires further
upstream fixes or migrations; the current deepmerge release has no patched version.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

The production build uses SvelteKit's Node adapter. Start it with `node build`.

## Deploying with Dokploy

1. Create an Application pointing to this repository. Select the **Dockerfile**
   build type, with `Dockerfile` at the repository root and build context `.`.
2. In **Environment → Build Time Arguments**, set `PUBLIC_CONVEX_URL` to your Convex deployment's public
   HTTPS URL (for example, `https://your-deployment.convex.cloud`). It must be
   reachable from both users' browsers and the app container. This value is
   embedded at build time; changing it requires rebuilding the image.
3. Set the runtime environment variable `ORIGIN` to the website's public origin,
   for example `https://lapita.example.com`.
4. Add your domain in Dokploy and route it to container port **3000**, then deploy.

The image runs as a non-root user and needs no persistent volumes. Convex itself
must already be running separately. The development-only `/__convex` proxy is not
included, so use a publicly reachable backend API URL rather than `localhost` or a
Docker-internal hostname. Local `.env` files and data exports are excluded from the image.

### Deploy self-hosted Convex during the Docker build

In Dokploy's **Environment** settings:

- Keep `PUBLIC_CONVEX_URL` in **Build Time Arguments**, pointing to your self-hosted
  Convex API (the API endpoint, not the dashboard or site-proxy endpoint).
- Add `DEPLOY_CONVEX=true` to **Build Time Arguments**.
- Add `CONVEX_SELF_HOSTED_ADMIN_KEY` with your backend's existing admin key to
  **Build-time Secrets**. Do not put the key in build arguments or runtime variables.

The build compiles the website first, then uses the installed Convex CLI to deploy
functions, indexes, and schema to that same backend. A deployment failure fails the
image build. The CLI uses its normal typecheck behavior and the committed generated
bindings (`--codegen disable`). No database reset or snapshot import runs.
The backend must be reachable from the Docker builder. The admin key is mounted
only for the deploy command and is not copied into image layers or the runtime.
See [Dokploy's build-time secrets](https://docs.dokploy.com/docs/core/applications/build-type)
and [Docker's secret mounts](https://docs.docker.com/build/building/secrets/).

Docker caches successful deployment steps. Changing source files reruns the step;
for an unchanged-source redeploy or a rotated secret, change the non-secret
`CONVEX_DEPLOY_REVISION` build argument (for example, to a new release number), or
build with `docker buildx build --no-cache-filter convex-deploy ...`.
The secret's value alone does not invalidate Docker's build cache.

The backend push and website rollout are separate operations: rolling back an image
or a later build/rollout failure does not roll back the Convex deployment. Keep backend
changes compatible with the currently running frontend during rollout.

To build with deployment from a local environment variable containing the admin key:

```bash
docker build \
  --build-arg PUBLIC_CONVEX_URL=https://convex.example.com \
  --build-arg DEPLOY_CONVEX=true \
  --secret id=CONVEX_SELF_HOSTED_ADMIN_KEY,env=CONVEX_SELF_HOSTED_ADMIN_KEY \
  -t lapita .
```

Without `DEPLOY_CONVEX=true`, Docker builds only the website and requires no admin
key. Deploy matching Convex functions separately in that mode. Test the deployment
wrapper without contacting a backend using:

```bash
node --import tsx --test tests/deploy-convex.test.ts
```

To build and run the same image locally:

```bash
docker build --build-arg PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud -t lapita .
docker run --rm -p 3000:3000 -e ORIGIN=http://localhost:3000 lapita
```

See [Dokploy's Dockerfile settings](https://docs.dokploy.com/docs/core/applications/build-type#dockerfile)
and [SvelteKit's Node adapter documentation](https://svelte.dev/docs/kit/adapter-node)
for additional deployment options.

## Importing local data

The repository includes a Convex snapshot at `data-export/data-export.zip` with
users, tracks, characters, karts, Grand Prix history, standings, races, and results.
The `load-data` script imports the whole snapshot, preserving IDs and references.

1. Install dependencies with `npm install` (or `bun install`).
2. Start a local backend with `npm run dev:convex -- --local` and keep it running.
   This configures a local deployment in `.env.local` (using `local:<name>` or
   `anonymous:anonymous-<name>` when running without an account).
3. In another terminal, import the snapshot:

   ```bash
   npm run load-data
   ```

The default import requires empty destination tables. To reset tables included in
the snapshot, run `npm run load-data -- --replace` and confirm the CLI prompt.
For unattended local resets, add `--yes`. Tables absent from the snapshot are kept.

You can supply another Convex snapshot or a different local configuration:

```bash
npm run load-data -- path/to/snapshot.zip --env-file .env.local
npm run load-data -- --dry-run
```

Paths are relative to the project root. For a self-hosted local backend, the env
file must contain `CONVEX_SELF_HOSTED_URL` (localhost, 127.0.0.1, or ::1) and
`CONVEX_SELF_HOSTED_ADMIN_KEY` instead of `CONVEX_DEPLOYMENT`. The script rejects
remote deployments and deploy keys. It does not use `PUBLIC_CONVEX_URL` to select
the import destination. Ensure the frontend's `PUBLIC_CONVEX_URL` points at the
local backend when viewing imported data.

Start the website with `npm run dev`. When visiting it from outside the VM, use
its network address on port 5173. In development, browser requests to a local
Convex backend go through the website's `/__convex` HTTP/WebSocket proxy, so only
the website port needs to be reachable. Server-side queries use the backend URL
directly. Restart Vite after changing the backend URL.

Run importer configuration tests with `npx tsx --test sample/load-data.test.ts`.
