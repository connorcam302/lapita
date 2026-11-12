# Working on Lapita

This file is the repository guide for coding agents. It applies to the whole project.
Keep it current when changing commands, routes, data contracts, deployment, or shared
design conventions. The source files and configuration are authoritative if this guide
falls out of date. See `README.md` for additional setup and deployment instructions.

## Product and scope

Lapita is a Mario Kart race tracker for a group of players. Users start a Grand Prix,
record finishing positions and character/kart choices, review standings, and explore
player history, track statistics, and combination stats. The app has a playful racing
identity, with yellow branding, character art, track images, medals, and dense data views.

Work in the existing checkout unless isolation is needed. Inspect `git status --short`
before editing: the working tree may already contain user changes. Preserve unrelated
changes, avoid repository-wide formatting, and do not overwrite generated files by hand.
Do not commit, deploy, migrate data, or reset a database just to validate a routine edit.

## Stack and tools

| Area                | Implementation                                                     |
| ------------------- | ------------------------------------------------------------------ |
| Package manager     | Bun 1.3.4, committed `bun.lock`                                    |
| Runtime             | Node 22.13+ on the 22.x line, or Node 24+ (`package.json` engines) |
| Frontend            | Svelte 5, SvelteKit 2, TypeScript 6, Vite 8                        |
| Styling             | Tailwind CSS 4 via `@tailwindcss/vite`, `tw-animate-css`           |
| UI                  | Local shadcn-svelte components, Bits UI 2, Lucide icons            |
| Backend             | Convex, `convex-svelte`, `convex-helpers`                          |
| Charts              | LayerChart 2, D3 scales/utilities, local chart wrappers            |
| Tables              | TanStack Table 8 and local Svelte rendering helpers                |
| Notifications/theme | `svelte-sonner`, `mode-watcher`                                    |
| Dates               | Day.js with relative-time plugin                                   |
| Quality             | Svelte Check, TypeScript, ESLint 10, Prettier                      |
| Production          | SvelteKit adapter-node 5, Docker, Dokploy                          |

Use the versions and scripts in `package.json`; avoid adding a second package-manager
lockfile. Major dependency updates need deliberate compatibility review. In particular,
SvelteKit 3 and TanStack Table 9 require migrations; do not assume their APIs match this app.

## Repository map

| Location                          | Responsibility                                                     |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/routes/`                     | SvelteKit pages, route data loaders, shared root layout/error page |
| `src/lib/components/custom/`      | App features: search, GP creation, track editing, stats            |
| `src/lib/components/ui/`          | Reusable UI primitives and chart/table integration                 |
| `src/lib/components/icon/`        | Custom house, road, podium, and medal icons                        |
| `src/lib/stores/states.svelte.ts` | Shared reference-data cache and Convex client                      |
| `src/lib/convex-url.ts`           | Browser/server backend URL selection                               |
| `src/lib/storage.svelte.ts`       | Reactive local-storage helper                                      |
| `src/lib/utils.ts`                | Class merging, scoring, lookups, colors, analytics                 |
| `src/lib/data/`                   | Track list, character/kart stat JSON, dataset accessors            |
| `src/convex/`                     | Schema, queries, mutations, legacy migrations, query wrappers      |
| `src/convex/_generated/`          | Convex-generated API, server, and data-model bindings              |
| `static/`                         | Public images, logo, favicon, and error animation                  |
| `sample/load-data.ts`             | Local-only Convex snapshot importer                                |
| `sample/load-data.test.ts`        | Node test-runner tests for importer configuration                  |
| `data-export/data-export.zip`     | Existing Convex snapshot used for local development                |
| `src/app.css`, `src/app.html`     | Global tokens, base styles, fonts, HTML shell                      |
| `components.json`                 | shadcn-svelte configuration and aliases                            |
| `convex.json`                     | Configures Convex functions under `src/convex/`                    |

`node_modules/`, `.svelte-kit/`, and `build/` are dependency/generated output. Do not
edit them. `$lib` is the standard SvelteKit alias for `src/lib`.

## Local development

Run commands from the repository root:

```bash
bun install --frozen-lockfile
bun run dev:convex
```

Keep Convex running. It uses the selected deployment and configures `.env.local`. The current CLI no longer accepts `--local`; select a local deployment with `bunx convex deployment select local` if needed. In another
terminal, ensure `PUBLIC_CONVEX_URL` points to that backend, then start the frontend:

```bash
bun run dev
```

Vite listens on `0.0.0.0`, normally port 5173 (check its output for the actual port).
Both the frontend and Convex must be available for a useful app session. The layout
waits for reference data; a reachable Vite page alone does not prove the app is ready.

### Environment and networking

- `PUBLIC_CONVEX_URL` must be a valid backend URL. It is imported through
  `$env/static/public`, so it is embedded at build time. Restart Vite after changes;
  rebuild production images when changing it.
- In development, `src/lib/convex-url.ts` directs browser requests for loopback
  backends (`localhost`, `127.0.0.1`, `::1`) through the app origin's `/__convex` path.
  `vite.config.ts` proxies HTTP and WebSocket requests to Convex. This allows access
  through the VM's frontend port without exposing the backend port to the browser.
- Server loaders use `PUBLIC_CONVEX_URL` directly. Do not replace their URL with a
  browser-origin proxy URL.
- `.env.local` overrides `.env`. To use the backend URL from `.env`, remove any
  `PUBLIC_CONVEX_URL` override from `.env.local` and restart Vite. Local Convex may
  write its URL back into `.env.local` when started.
- `.env` and `.env.local` are ignored. Inspect only necessary values, never copy
  keys into documentation, logs, commits, or browser-visible variables.

### Loading realistic local data

The importer preserves snapshot IDs and cross-table references. It uses the chosen
env file, **not** `PUBLIC_CONVEX_URL`, to select the destination.

```bash
bun run load-data -- --dry-run
bun run load-data
bun run load-data -- path/to/snapshot.zip --env-file .env.local
```

The default import expects empty destination tables. `--replace` resets tables
included in the snapshot; tables absent from the snapshot are kept. Only use it when
the requested task includes resetting that local data. `--yes` suppresses replacement
confirmation and requires `--replace`; never add it casually.

Accepted targets are local/anonymous Convex deployments or a loopback self-hosted
backend with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. Remote
deployments and deploy keys are rejected. Preserve these safeguards. Legacy migration
functions are not the normal seed path.

## Routes and interacting with the app

| Route                | Purpose and main files                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Grand Prix overview: latest GP, standings, monthly history in batches of 12; `+page.svelte`, `home-data.ts`                                                                 |
| `/grandprix`         | All Grand Prix archive: search by GP number/player; combine participant, winner, track, completion status and inclusive dates; sort newest/oldest. Filters live in the URL. |
| `/grandprix/deleted` | Unlisted recovery page for deleted GPs; open by URL to restore races, results, and standings. Excluded from navigation/search and marked noindex.                           |
| `/grandprix/[id]`    | Race selection, result entry, standings, history, win-chance and combo charts; route page and `RaceWinChanceChart.svelte`                                                   |
| `/players/[userId]`  | Player summary, track averages, character/kart usage, GP/race history; route page and `TrackBars.svelte`                                                                    |
| `/tracks/[trackId]`  | Track summary, player performance, finishing distribution, combination stats, and race history with expandable results; `tracks.detail`, `$lib/track-stats.ts`              |
| `/track-stats`       | Sortable track statistics; route page, `DataTable.svelte`, `columns.ts`, `SortableHeader.svelte`                                                                            |
| `/stats/calculator`  | Choose character/kart; compare eight stats and their averages in a table/chart                                                                                              |
| `/records`           | All-time player rankings for wins, podiums, GP scores, average finishes and streaks; `src/lib/records.ts`, `src/convex/records.ts`                                          |
| `/test`              | Existing experimental stats/chart page; not a substitute for automated tests                                                                                                |

Dynamic URL segments are Convex document IDs, not GP order numbers or player names.
Use existing data to obtain IDs; do not invent them.

The root `Navbar.svelte` contains the home logo, active section links for Grand Prix,
Track Stats, Records, and Calculator, and `SearchBox.svelte`. Links wrap below search on narrow
screens. Search groups site pages, players, the 12 most recent GPs, tracks, characters,
and karts, with arrow-key/Enter/Escape handling and an empty state. The recent-GP query
starts on first search focus. Track results link to `/tracks/[trackId]` for track stats and race history. Track Stats uses the shared Bungee page heading and a compact, theme-aware comparison table, initially sorted by race count descending. Headers toggle sorting and show its direction; numeric columns align right, and the table scrolls on narrow screens. “Avg. racers” means recorded finishes per scheduled race; “Avg. finish” belongs to the leading player, and “Lead gap” compares that player with the next player’s average. Track Stats names also link to these pages; legacy `/track-stats?track=<id>` filters remain supported, and Show all tracks clears the filter. Character/kart results open
`/stats/calculator?character=<id>` or `?kart=<id>`, taking precedence over validated
saved selections. Search matches all query words against names and category keywords.
The homepage history hash waits for history to load before scrolling to its section.

For a local browser smoke test:

1. Open `/`, wait for reference data/history, and open an existing GP card.
2. Change the selected race; the `track` query parameter stores its race ID. The GP
   results table uses full-cell medal colors for the top three places.
3. Use search to open a player, Track Stats, and Calculator. Check table sorting,
   selectors, chart tooltips, images, and loading/error behavior.
4. Only on a disposable local backend, test creating a GP or submitting/editing a
   result. These controls write real backend data; browsing a page is read-only.

`StartGPButton.svelte` opens a participant-selection sheet with labeled checkboxes, provides Select All, and
requires at least four selected players in the UI. Its responsive trigger fits narrow screens; failed creation keeps the selection and shows a retry toast. Creating navigates to the new GP.
The GP page heading includes Add racers and Delete GP controls (`ManageGP.svelte`). Adding
existing users creates zero-point standings and blank results for every race, including earlier
races that can be backfilled; completion still requires every participant's result. The participant
list subscribes to `gps.getOne` so result entry and analytics update live. `gps.addRacers` validates
users and deduplicates additions. Deletion requires confirmation and `gps.remove` sets an optional `grandPrix.deletedAt`
timestamp, retaining all GP/race/result/standing documents and IDs. Deleted GPs are hidden
from normal lists, player history, records, track stats, and forecasts; backend mutations
reject edits while deleted. The URL-only `/grandprix/deleted` page
uses `gps.deleted` and `gps.restore` to recover them without an expiry. GP numbers stay
reserved while deleted. `gp_visibility.ts` filters retained child records by active parents. Missing GP URLs
return 404. Neither mutation adds authentication. Focused tests:
`node --import tsx --test tests/gp-management.test.ts`.

The GP result form selects racer, character, kart, race, and finishing position. A
successful save moves to the next race when one exists and shows a toast. Saving the final race keeps it selected. The form accepts only integer finishes from 1–24, prevents duplicate submissions, and retains selections on errors. `EditTrackButton`
offers a three-lap track or separate start/end tracks for a transition.

The GP Cumulative tab shows running points in race order with participant-aligned columns,
using `placementToPoints`. Only integer finishes from 1–24 count; unrecorded cells show a dash,
and the Total points footer includes all recorded scores. Medal cell colors reflect cumulative
competition ranks (ties share places). Results uses the same ordered rows with per-race positions.
The helper is `cumulative-points.ts`; run its focused tests with:

```bash
node --import tsx 'src/routes/grandprix/[id]/cumulative-points.test.ts'
```

The GP results table includes a Points footer summing valid recorded finishes with
`placementToPoints`; unplayed races contribute no points. Projected final scores appear as xPoints
in the Grand Prix stats table. Recorded finishes use actual points; remaining racers are ranked by the existing per-end-track win
probabilities and assigned points for the unoccupied finishing places. Equal rounded probabilities
use unrounded model weight, lower track average, lower recent-five average, lower best finish,
then higher race count. Exact ties use stable racer ID order, so every predicted place receives
whole-number points; missing probability history shows a dash. Projections
update from live result/stat queries and equal actual scores once all finishes are recorded.
The xPoints tab uses race rows and participant columns like Results. Each cell shows
only a signed actual-minus-expected points gap on scaled green/yellow/red cell backgrounds (+3 green, +5 dark green; mirrored reds below expected,
with white text from ±4 and colors clamped at ±5); unrecorded
finishes show a dash. Track links select that race, and a Total so far footer compares each
racer's recorded finishes with independent probability-ranked points for those same races.
These comparisons use current track history, not saved pre-race forecasts; they can change
as results update. The calculation lives beside the page in `expected-points.ts`. Run its focused tests with:

```bash
node --import tsx 'src/routes/grandprix/[id]/expected-points.test.ts'
```

The Grand Prix stats section has one table with grouped Starting stats and Ongoing stats columns. Starting stats show projected
xPoints and GP win chance with all GP races treated as unplayed, using `results.stats` with
`beforeGrandPrixId` to include only earlier GP orders. These are reconstructed forecasts, not
stored snapshots: edits to earlier history, participants, or scheduled tracks can change them.
Ongoing stats show current/projected points, maximum possible points across the 24-place
scoring system, and estimated GP win chance. All columns sort the shared racer rows; the default is ongoing points descending. Unavailable forecasts stay last in either sort direction.
`gp-outlook.ts` samples 5,000 weighted remaining group finish orders with a repeatable
seed, keeping recorded results and their occupied places fixed. Races are independent and
outside-group finishers are not modeled. Missing track probabilities leave chances unavailable;
completed GPs use exact competition ranks, including tied wins/podiums. Min/max limits are
per-player bounds, not outcomes every racer can achieve together. Focused tests:

```bash
node --import tsx 'src/routes/grandprix/[id]/gp-outlook.test.ts'
```

The GP page persists `selectedCharacterId`, `selectedKartId`, and `selectedUserId`
in browser local storage. The calculator also reads the character/kart
selection keys. These IDs may become stale after switching or resetting databases;
validate saved selections against loaded records when changing this behavior.

Player profiles use Overview, Tracks, Track rivals, Combinations, and History tabs. The overview keeps the
most-used character/kart art, summary record, best/toughest tracks, and recent GP/race results.
Personal records reuse `records.get` for completed-GP best score, longest winning streak,
podium finishes, and GP wins, with overall ranks and a link to the best-score GP. Their
loading/error states are independent of the profile; these records exclude unfinished races
and GPs using the same rules as the Records page.
Track comparisons show full names, sample sizes, and paired all-time/recent averages; recent
averages use up to ten available finishes, ordered by GP order then result creation time.
`TrackRivals.svelte` loads `races.getStats` when its tab mounts, matching the Track Stats
all-time end-track averages. `track-rivals.ts` computes competition ranks, gaps to the leader,
and leading margins over the best other racer using unrounded averages. Leading includes
shared firsts but excludes tracks where the player is the only racer. Filters distinguish
leading, within 0.50 average positions of the lead, chasing, solo, and unraced tracks. Positive
gaps below 0.01 display as `<0.01`; links open the track detail or rival profile. Test with
`node --import tsx 'src/routes/players/[userId]/track-rivals.test.ts'`.
`src/routes/players/[userId]/player-data.ts` filters placements to integers 1–24 and owns profile
summaries. Track summaries group by end track; combination best/worst tracks retain start-track
grouping. GP first places and combination GP points include current standings; each GP is
credited to its most-used combination. History loads 20 entries at a time, and race links select
the corresponding race with `?track=<raceId>`. Empty profiles and missing combination choices
are supported. Run focused calculation tests with:

```bash
node --import tsx 'src/routes/players/[userId]/player-data.test.ts'
```

Track detail pages count races by end track (including transitions), using the `races.trackEndId` index. Performance statistics exclude positions outside integer 1–24. History includes scheduled and partial races, ordered by GP and race number descending, revealed in batches of 12; history rows reuse the homepage `HistoryRow.svelte` layout, show the leading three racers by default, and offer Show all results / Show top three buttons. Race headings link to the GP with that race selected. `$lib/track-stats.ts` owns the tested aggregation. The detail query currently loads the full history for one track to compute lifetime stats.

## Data flow and code conventions

- `src/routes/+layout.svelte` imports global CSS, calls `setupConvex(convexUrl)`, mounts
  `ModeWatcher`, the toaster, and navbar, and gates page content on
  `convexStore.isLoaded` (while still allowing route errors to render).
- `convexStore` creates its own `ConvexClient` and fetches karts, characters, users,
  and tracks concurrently. These are initial query results, not subscriptions.
  Feature pages use `useQuery` for live results and `useConvexClient().mutation(...)`
  for writes. Do not assume cached reference data refreshes after a mutation.
- `src/convex/convex.svelte.ts` also provides custom reactive `ConvexQuery` and
  `ConvexQueryPaginated` classes. Read their lifecycle before using them; most existing
  feature pages use `convex-svelte` directly.
- Home, GP, player, calculator, and test pages explicitly disable SSR in `+page.ts`.
  GP and player routes still have `+page.server.ts` loaders for initial document
  lookup. Preserve this distinction; disabling SSR does not remove server loaders.
- Use Svelte 5 runes (`$props`, `$state`, `$derived`, `$effect`, `$bindable`), snippets,
  and event properties such as `onclick` in new components. Some older components
  still use legacy syntax; avoid unrelated conversions.
- Keep route-specific components beside their page; put reusable product components
  in `custom/` and generic primitives in `ui/`. Reuse barrel exports where present.
- Use generated `Id<'table'>`, `Doc`, and `FunctionReturnType<typeof api...>` types
  for backend contracts. Validate query/mutation inputs with Convex validators.
- Use indexes declared in `schema.ts`; add an index deliberately when query access
  patterns require it. Regenerate Convex bindings through its CLI after backend API
  changes, and review generated diffs rather than hand-editing them.
- Keep backend-imported helpers free of browser-only side effects. `results.ts` and
  `migrations.ts` already import scoring/analytics from `$lib/utils`.
- TypeScript is strict. Match Prettier: tabs, single quotes, no trailing commas,
  100-column print width. Let the configured plugins format Svelte and Tailwind classes.

## Backend model and behavior to preserve

`src/convex/schema.ts` defines eight tables:

| Table                | Fields and relationships (besides Convex metadata)                             |
| -------------------- | ------------------------------------------------------------------------------ |
| `users`              | `name`                                                                         |
| `tracks`             | `name`, `img`                                                                  |
| `characters`         | Optional `name`, optional `img`                                                |
| `karts`              | `name`, `img`                                                                  |
| `grandPrix`          | Numeric `order`, array of participant user IDs, optional `deletedAt` timestamp |
| `grandPrixStandings` | GP ID, user ID, points                                                         |
| `races`              | Numeric `order`, GP ID, start/end track IDs, `transition`                      |
| `results`            | Race ID, user ID, optional/null position, optional character/kart IDs          |

- `gps.newGp` selects up to 16 distinct tracks without replacement. `tracks.valid`
  excludes Rainbow Road. Tracks appearing once/twice in the preceding two GPs are
  weighted 0.8/0.6 instead of 1. It creates races, standings, and participant results.
  Race order is zero-based; display adds one. GP order increments the previous GP.
- `gps.getAll` returns `{ page, hasMore }`. Each entry includes `raceCount`,
  `completedRaces`, `nextRaceId` (first incomplete race), and `coverTrackId` (the next
  race’s end track, or the opening race’s end track for completed GPs). A race is complete
  only when every GP participant has an integer position from 1–24; empty race lists
  are not completed GPs. `src/lib/grand-prix.ts` owns the shared race completion predicate;
  `src/routes/home-data.ts` owns the homepage GP completion check. Previous GP podium
  rows show red points gaps to the racer immediately above, including zero for ties.
- GP creation also supports fewer than two preceding GPs, including after deletion.
  Use the snapshot for realistic local workflows.
- `races.updateTrack` derives `transition` from unequal start/end IDs. Three-lap races
  use the same track ID for both ends.
- `results.update` validates integer finishes from 1–24, race/GP ownership, participant
  membership, and character/kart existence before writing. It updates the existing result
  and recomputes that racer's GP standing from valid source results atomically, excluding
  other GPs. This repairs previously corrupt totals on a valid save and avoids propagating
  invalid historical finishes. Missing result/standing records raise an error. Regression tests:
  `node --import tsx --test tests/result-update.test.ts`.
- `placementToPoints` in `src/lib/utils.ts` is the scoring authority: 1st=15, 2nd=12,
  3rd=10, 4–5=9, 6–7=8, 8–9=7, 10–12=6, 13–15=5, 16–18=4, 19–21=3,
  22–23=2, 24=1; 0 maps to 0. Do not substitute another Mario Kart points system.
- Standings sort by descending points and use competition ranking for ties (1,1,3).
  Race position averages improve as numbers decrease.
- Track statistics in `races.getStats` group by **end** track. `results.stats` queries
  historical races where both start and end equal the requested track; these queries
  intentionally have different current selection behavior. Inspect both before
  changing how transitions contribute to analytics.
- The calculator resolves JSON stats by exact character/kart name, across road,
  terrain, and water speed; acceleration; weight; and road, terrain, and water handling.
  Keep database names and dataset names aligned.
- Win chances are heuristic estimates from historical average positions and optional
  recent form (`calculateRaceWinChance`), not a measured or guaranteed probability.
- The current backend functions have no authentication/authorization checks. Do not
  assume the UI protects mutations; enforce any new access restrictions server-side.

## Design system

Preserve the existing racing identity when extending the UI. Use reusable primitives
and existing layouts as the starting point; a redesign should be explicitly scoped.

### Tokens, typography, and components

- `src/app.css` owns light/dark semantic tokens and Tailwind `@theme` mappings.
  Prefer `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`,
  `border-border`, and other semantic utilities over new hard-coded neutral colors.
- Brand utility `lapita` is `oklch(0.861 0.1695 92.73)` (bright yellow). Light primary
  is amber `#f59e0b`; dark primary is yellow `#f5cc24`. Light surfaces are white/gray;
  dark background is `#171717`, with `#262626` cards and `#404040` borders.
- `font-title` is Bungee for the logo/display identity; `font-body` is Oswald. General
  sans, serif, and mono tokens are Inter, Source Serif 4, and JetBrains Mono.
  Fonts load through Google Fonts in `src/app.html` and `src/app.css`.
- Base radius is `0.375rem`, spacing unit `0.25rem`, with subtle shared shadows.
  Use existing radius, spacing, and shadow utilities to keep surfaces consistent.
- The homepage preserves the original diagonal yellow/charcoal logo banner in a compact
  `Header.svelte`, Bungee display headings, and shared podium number badges. The latest GP
  uses `src/routes/LatestGrandPrix.svelte`: a shared heading/action row, track location
  preview, previous/current track details, and race progress beside compact standings
  with red gaps to the racer above. Track context comes from `races.inGrandPrix`: current
  is the first unfinished race (the final race after completion), previous is the race
  immediately before it in race order. Both display end tracks; the first race has no previous track.
  It stacks on mobile and switches between start/continue/results actions by completion. History lists are grouped by month. Keep copy plain and sentence case, with
  one yellow primary action. Preserve the racing identity without slogans or redundant icons.
  The navbar and homepage are centered at `max-w-6xl`; the navbar hides the wordmark on
  small screens to keep search usable. Data pages commonly use centered
  `max-w-4xl`/`max-w-5xl` containers, wrapping cards, and compact tables.
- Reuse local Card, Button, Select, Tabs, Sheet, Dialog, Table, Tooltip, ScrollArea,
  Input, Label, Progress, and Separator components. Compose classes with `cn()`.
  `components.json` identifies the neutral shadcn-svelte base configuration.
- Buttons support default/destructive/outline/secondary/ghost/link variants and
  default/sm/lg/xl/icon sizes. The existing **secondary** variant is the bright
  `bg-lapita` action style; do not infer its appearance from the name alone.
- Respect dark mode through `mode-watcher` and semantic tokens. The navbar has a sun/moon
  button beside search that toggles light/dark mode and persists the selection.

### Data visuals, assets, and interaction

- Use shared `Chart.Container`, `ChartConfig`, and `Chart.Tooltip` with LayerChart 2
  `ChartState`/series APIs. Follow existing `BarChart` examples; older LayerChart
  examples may not match the installed version. Keep chart keys, labels, and series
  colors consistent, and give chart containers an explicit usable height.
- `--chart-1` through `--chart-5` vary by theme. Shared `chartColours`,
  `getPositionColour`, `getConsistencyColorGradient`, and `getStatColour` live in
  `src/lib/utils.ts`; reuse them for the same meaning. Position colors run green
  through yellow to red. `custom/PositionBadge.svelte` renders rounded-square gold, silver,
  and bronze number badges for the top three places, plain numeric places below the podium,
  and a dash for missing results. Reuse it in standings and result views; the GP table
  uses full gold/silver/bronze cells for the top three places, plain cells below the podium,
  and no color-mode toggle.
- Shared table rows highlight across the full row on hover. A subtle cell overlay preserves
  medal and xPoints background colors, including inline colors.
- Pair color with text/numbers. Preserve table headings, sorting affordances, visible
  focus rings, keyboard access, form labels, useful image alt text, and dialog titles.
  Use semantic buttons/links for new interactive surfaces.
- Existing motion uses roughly 500ms fades/chart tweens and a bouncing logo while
  loading. Keep additions restrained and account for reduced-motion preferences.
- Check narrow screens: allow cards to wrap, keep controls usable, and provide
  scrolling for dense tables instead of clipping their content.
- Files in `static/` are served at `/`, not `/static/`. Database `img` values are
  generally asset stems: `/characters/{img}.png`, `/karts/{img}.png`,
  `/tracks/icons/{img}.png`, and `/tracks/locations/{img}.jpg`.
  Character icon assets also exist under `/characters/icons/`. Verify a variant
  exists before using it; preserve image aspect ratios.
- Reuse `/lapita-logo.png`, existing Mario Kart art, and Lucide/custom icons. The
  error page uses `/lakitu-nuh-uh.gif` with back/home navigation.
- Distinguish loading, empty, error, and success states. Use the existing toaster
  for mutation feedback, prevent duplicate submissions, and retain enough context
  for a user to recover from a failed save.

## Validation

For app code changes, use the relevant checks and report their actual outcomes:

```bash
bun run check
bun run lint
bun run build
```

`check` synchronizes SvelteKit types then runs Svelte Check. `lint` runs Prettier
before ESLint, so a formatting failure prevents ESLint from running in that command.
Format touched files with `bunx prettier --write path/to/file`; `bun run format`
rewrites the whole repository and is usually too broad.

For homepage and race completion checks:

```bash
bun run tsx --test src/routes/home-data.test.ts
```

For Records calculations:

```bash
bun run tsx --test src/lib/records.test.ts
```

Records use completed participant races only; GP wins and best scores require a nonempty,
fully completed GP. Scores are recomputed with `placementToPoints`, tied GP leaders each
receive a win, and rankings use competition places. Average finish requires ten races.
Winning streaks follow GP/race order across GPs entered; a loss or unfinished race breaks
the streak. The live `records.get` query scans historical tables once and returns rankings;
revisit aggregation if history grows beyond Convex query read limits.

For importer changes:

```bash
bun run tsx --test sample/load-data.test.ts
```

There is no general `test` script or configured browser test suite. Add focused tests
when behavior warrants them; do not describe the `/test` route as test coverage.
For UI changes, also smoke-test the affected route using a populated local backend,
including a narrow viewport and relevant theme, selectors, dialogs, and tooltips.
For documentation-only changes, verify paths/commands and run Prettier on the document;
an application rebuild is unnecessary.

The README records existing type, formatting, lint, and dependency-audit findings.
Establish the current baseline before attributing failures to your change; do not hide
diagnostics or expand a focused task into an unrelated cleanup. Run `bun audit` for
dependency changes and report current findings rather than relying on historical counts.

## Production and deployment

```bash
bun run build
bun run preview
# Run the adapter-node output directly:
node build
```

The Dockerfile uses Bun 1.3.4 to install/build and Node 22 for a non-root runtime,
listening on `0.0.0.0:3000`. Convex must be hosted separately. By default the image
build packages only the website. Set build argument `DEPLOY_CONVEX=true` and provide
BuildKit secret `CONVEX_SELF_HOSTED_ADMIN_KEY` to deploy functions/indexes/schema after
website compilation. `scripts/deploy-convex.sh` targets `PUBLIC_CONVEX_URL`, uses the
installed CLI with committed bindings, and fails the build on deployment errors.
The runtime copies the website from the `convex-deploy` stage, ensuring it runs.
Never put the admin key in ARG/ENV, source files, or runtime configuration. Change
`CONVEX_DEPLOY_REVISION` or bypass the `convex-deploy` stage cache to redeploy unchanged
source or rotate a secret; secret values alone do not invalidate the cache.
Backend pushes cannot be rolled back by rolling back the website image. Wrapper tests:
`node --import tsx --test tests/deploy-convex.test.ts`.

For Dokploy, use the root Dockerfile and repository-root build context. Set
`PUBLIC_CONVEX_URL` as a **build argument**, `ORIGIN` as the runtime public site
origin, and route the domain to port 3000. The production backend URL must be
reachable from both browser and container; the Vite `/__convex` proxy is dev-only.
The image needs no persistent volume. `.dockerignore` excludes local env files,
data exports, sample scripts, dependencies, and build output from the build context.

## Known rough edges and troubleshooting

These are observed implementation limitations, not behaviors to copy into new code:

- An unreachable Convex backend or failed reference query can leave the initial
  bouncing-logo gate waiting. Check backend reachability, URL, dev proxy, and data.
- Several views assume populated arrays and related records. Track Stats accesses
  the first two player averages; Include missing/empty data when working on these paths.
- `src/convex/migrations.ts` contains legacy fields/indexes absent from the current
  schema and destructive replacement/recalculation operations. Do not run it as a
  setup shortcut or assume its types describe the current model.
- The final `@theme` block in `src/app.css` contains literal `hsl(...)` placeholders,
  including another primary declaration. Treat these as incomplete CSS, not usable
  token values; inspect computed styles when touching the theme.
- Some feature files contain debug logging, legacy numeric-ID types, raw HTML table
  snippets, and direct browser-storage reads. Prefer typed, SSR-aware, accessible
  patterns for additions, and escape untrusted content if modifying raw snippets.

Finish changes with a brief explanation of what changed, why, what was verified, and
any remaining limitation. Update this guide when the change invalidates its instructions.

### Grand Prix archive

`/grandprix` uses the live `gps.archive` query and `$lib/gp-archive.ts`. The query scans
GPs, races, results and standings once to return the complete archive; filters apply before
revealing rows in batches of 24, so older matches are always included. Revisit server-side
pagination/aggregation if history approaches Convex read limits. Completion uses
`hasAllResults` and requires a nonempty race list; winner filters include every tied first
place only for completed GPs. Track filtering matches either start or end of a transition.
Dates use the viewer's local calendar and include both boundary days. The navbar Grand Prix
link opens the archive; the home logo returns to the overview. Search and the homepage
Previous Grand Prix section also link to the archive. Run calculation checks with
`bun run tsx --test src/lib/gp-archive.test.ts`.
