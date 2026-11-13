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

Keep Convex running. It uses the selected deployment and configures `.env.local`.
A running local backend can still serve older functions if the dev watcher has stopped.
`bunx convex codegen` generates bindings but does not sync running queries/mutations;
start `bun run dev:convex` before browser verification of backend changes. The current CLI no longer accepts `--local`; select a local deployment with `bunx convex deployment select local` if needed. In another
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
- The recap Copy image button uses the browser Clipboard API, which requires trusted HTTPS
  or a loopback/localhost origin. A browser outside the VM visiting `http://<vm-ip>:5173`
  cannot use programmatic image copying. Use host-to-VM port forwarding with a localhost
  URL or trusted HTTPS; the native image context menu and PNG download still work over HTTP.
  Copy failures distinguish insecure origins, unsupported APIs, embedded clipboard policy,
  and permission errors, with optional browser error details. Do not report copy success
  until the clipboard write resolves. Focused tests: `node --import tsx src/lib/recap-image.test.ts`.
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

| Route                | Purpose and main files                                                                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                  | Grand Prix overview: latest GP, standings, monthly history in batches of 12; `+page.svelte`, `home-data.ts`                                                                             |
| `/grandprix`         | All Grand Prix archive: search by GP number/player; combine participant, winner, track, completion status and inclusive dates; sort newest/oldest. Filters live in the URL.             |
| `/grandprix/deleted` | Unlisted recovery page for deleted GPs; open by URL to restore races, results, and standings. Excluded from navigation/search and marked noindex.                                       |
| `/grandprix/[id]`    | Race selection, result entry, standings, history, win-chance and combo charts; route page and `RaceWinChanceChart.svelte`                                                               |
| `/grandprix/[id]/recap` | Completed GP podium, points, signed xPoints comparison, starting win chances, per-race combo ratings and local PNG download. |

The recap's Driver of the Day score is points above xPoints + 3 × (race wins minus expected
wins). Expected wins sum the per-race group win probabilities divided by 100; both award
expectations use `beforeGrandPrixId` history, excluding this GP. These are reconstructed,
not saved forecasts, and do not model outside-group racers. The largest positive score wins;
equal scores (rounded to six decimals) share the award. Complete finishes and expectations
for every participant, with at least two racers, are required. The recap and both PNG renderers
show the award and its points/wins breakdown. In PNGs the compact award box follows the
standings, with racer names beside the two signed metrics; podium boxes always show race wins. Helpers: `recapDriversOfTheDay` in `$lib/gp-recap.ts`
and `calculateAwardComparisons` beside the GP page in `expected-points.ts`.

| `/players` | Player directory: name search, sorting, profile links, recorded races, race/GP wins and average finish; one `users.directory` summary query. |
| `/players/[userId]`  | Player summary, track averages, character/kart usage, GP/race history; route page and `TrackBars.svelte`                                                                                |
| `/rivalry` | Head-to-head comparison of two players in shared races; URL parameters `a`, `b`, and `scope=all\|5\|10\|20`. |
| `/tracks/[trackId]`  | Track summary, player performance, finishing distribution, combination stats, and race history with expandable results; `tracks.detail`, `$lib/track-stats.ts`                          |
| `/track-ownership`   | Compatibility redirect to `/track-stats?view=ownership`. |
| `/track-stats`       | Track statistics with Table and Ownership grid views; `DataTable.svelte`, `TrackOwnership.svelte`, `columns.ts`, `SortableHeader.svelte`                                                                                        |
| `/stats`             | All-time dashboard: cumulative GP/race wins with player toggles, sortable player comparison, win rates, average points per race, average finishes, combo usage and monthly GP activity. |
| `/stats/calculator`  | Choose character/kart; compare 13 varying stats and their averages in a table/chart                                                                                                          |
| `/records`           | All-time player rankings for wins, podiums, GP scores, average finishes and streaks; `src/lib/records.ts`, `src/convex/records.ts`                                                      |
| `/test`              | Existing experimental stats/chart page; not a substitute for automated tests                                                                                                            |

Dynamic URL segments are Convex document IDs, not GP order numbers or player names.
Use existing data to obtain IDs; do not invent them.

The root `Navbar.svelte` contains the home logo, active section links for Players, Grand Prix,
Track Stats, Stats, Records, and Calculator, and `SearchBox.svelte`. Links wrap below search on narrow
screens. Search groups site pages, players, the 12 most recent GPs, tracks, characters,
and karts, with arrow-key/Enter/Escape handling and an empty state. The recent-GP query
starts on first search focus. Track results link to `/tracks/[trackId]` for track stats and race history. Track Stats uses the shared Bungee page heading and a compact, theme-aware comparison table, initially sorted by race count descending. Headers toggle sorting and show its direction; numeric columns align right, and the table scrolls on narrow screens. “Avg. finishes / race” means recorded finishes per scheduled race; “Avg. finish” belongs to the leading player, and “Lead gap” compares that player with the next player’s average. Track Stats names also link to these pages; legacy `/track-stats?track=<id>` filters remain supported, and Show all tracks clears the filter. Character/kart results open
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

Completed GPs with exactly two racers tied for first show Knockout Tour as the extra race
in Results, followed by its result-entry form (`KnockoutTour.svelte`). Only those two racers can
submit integer finishes from 1–24 via `gps.recordKnockoutResult`; the backend checks eligibility
from completed source results. `grandPrix.knockoutResults` stores the finishes. Positions must
be different; both are required before the better finish sets `grandPrix.knockoutWinnerId`.
Results can be edited or removed individually. Knockout Tour decides first and second without
adding GP points or contributing to normal track statistics, race wins, or forecasts.
`KnockoutScoreMark.svelte` adds a small Lucide Plus icon beside the winner’s GP score with the
accessible label/title “Won via Knockout Tour”. The mark appears in GP standings, totals,
home/history, archive, player GP history, best-GP-score records/personal records and recaps
(including PNG scores). Aggregate points and win counts are not marked as individual GP scores.
The shared statistics help explains the plus and excludes Knockout Tour from points and ordinary
race statistics.
The shared ranking helpers propagate the winner to standings, recaps/images, player history,
records, directory and stats. Changing a normal finish, adding racers, or undoing manual
completion clears Knockout Tour results and its winner. Character/kart-only edits preserve them.
Focused checks: `node --import tsx --test tests/knockout-tour.test.ts tests/gp-management.test.ts tests/result-update.test.ts`.

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
whole-number points; unavailable probability data shows a dash. Projections
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

The Grand Prix stats section has one table with grouped Starting stats and Ongoing stats columns. Its numeric
points columns omit Knockout Tour plus markers (the score markers remain in standings and GP
results totals). Starting and ongoing GP win percentages have keyboard-focusable shadcn Hover Card
triggers; percentages use adaptive precision and largest-remainder rounding so each column totals 100%. Hover cards explain simulation limits. The local
`ui/hover-card` primitives wrap the installed Bits UI `LinkPreview` API. Starting stats show projected
xPoints and GP win chance with all GP races treated as unplayed, using `results.stats` with
`beforeGrandPrixId` to include only earlier GP orders. These are reconstructed forecasts, not
stored snapshots: edits to earlier history, participants, or scheduled tracks can change them.
Ongoing stats show current/projected points, maximum possible points across the 24-place
scoring system, and estimated GP win chance. All columns sort the shared racer rows; the default is ongoing points descending. Unavailable forecasts stay last in either sort direction.
`gp-outlook.ts` samples 5,000 weighted remaining group finish orders with a repeatable
seed, keeping recorded results and their occupied places fixed. Races are independent and
outside-group finishers are not modeled. `results.stats` fills missing per-track racer history
with their recency-weighted overall valid finishes (including transitions), using the same
GP cutoff and deleted-GP exclusions. Racers with no valid history use a neutral average of
12.5 (the midpoint of places 1–24). Track-specific history always takes precedence; raw track
stats retain only real track results. The fallback feeds race chances, xPoints comparisons,
and both starting/ongoing GP forecasts. Focused regression check:
`node --import tsx tests/forecast-history.test.ts`. Unavailable query data still leaves chances unavailable;
GP win forecasts split tied-leader credit equally until a recorded Knockout Tour winner takes 100%; podium forecasts retain competition ranks. Min/max limits are
per-player bounds, not outcomes every racer can achieve together. Focused tests:

```bash
node --import tsx 'src/routes/grandprix/[id]/gp-outlook.test.ts'
```

The GP page persists `selectedCharacterId`, `selectedKartId`, and `selectedUserId`
in browser local storage. The calculator also reads the character/kart
selection keys. These IDs may become stale after switching or resetting databases;
validate saved selections against loaded records when changing this behavior.

Player profiles use Overview, Tracks, Combinations, and History tabs. Tracks combines a horizontally scrollable grouped vertical
bar chart of all-time/last-10 averages with the Track rivals table. The compact chart uses
slim paired bars and track initials on its axis; tooltips retain full track names. Rival columns sort on
header clicks (including last-five average), with no sort dropdown. Ranks omit the racer-count
denominator; columns run Track, Recorded finishes, Avg. finish, Last 10 avg., Last 5, Rank, Gap to lead.
Last-five finish badges run newest first; the table omits the current-leader column. Signed gaps are green/negative when leading the best other racer,
red/positive when chasing the leader, zero for ties, and unavailable for solo/unraced tracks. The overview keeps the
most-used character/kart art, summary record, best/toughest tracks with at least five valid finishes, and recent GP/race results.
Personal records reuse `records.get` for completed-GP best score, longest winning streak,
podium finishes, and GP wins, with overall ranks and a link to the best-score GP. Their
loading/error states are independent of the profile; these records exclude unfinished races
and GPs using the same rules as the Records page.
Track comparisons show full names, sample sizes, and paired all-time/recent averages; recent
averages use up to ten available finishes, ordered by GP order then result creation time.
`TrackRivals.svelte` loads `races.getStats` when Tracks mounts, matching the Track Stats
all-time end-track averages. `track-rivals.ts` computes competition ranks, gaps to the leader,
and leading margins over the best other racer using unrounded averages. Ranks and gaps require
five valid results per player per track; smaller samples stay visible as unranked. Leading includes
shared firsts but excludes tracks where the player is the only racer. Filters distinguish
leading, within 0.50 average positions of the lead, chasing, and solo tracks. Unraced tracks
are excluded from the table and summary. Positive
gaps below 0.01 display as `<0.01`; links open the track detail or rival profile. Test with
`node --import tsx 'src/routes/players/[userId]/track-rivals.test.ts'`.
`src/routes/players/[userId]/player-data.ts` filters placements to integers 1–24 and owns profile
summaries. Track summaries group by end track; combination best/worst tracks retain start-track
grouping and require five valid finishes per combination per track. GP wins use the shared completed-GP rules; combination GP points include current standings; each GP is
credited to its most-used combination. History loads 20 entries at a time, and race links select
the corresponding race with `?track=<raceId>`. Empty profiles and missing combination choices
are supported. Run focused calculation tests with:

```bash
node --import tsx 'src/routes/players/[userId]/player-data.test.ts'
```

Track detail pages count races by end track (including transitions), using the `races.trackEndId` index. Performance statistics exclude positions outside integer 1–24. History includes scheduled and partial races, ordered by GP and race number descending, revealed in batches of 12; history rows reuse the homepage `HistoryRow.svelte` layout, show the leading three racers by default, and offer Show all results / Show top three buttons. Race headings link to the GP with that race selected. `$lib/track-stats.ts` owns the tested aggregation. The detail query currently loads the full history for one track to compute lifetime stats.

`TrackSetup.svelte` adds Statpedia terrain estimates and recommended character/kart pairs to
each track detail page. Terrain percentages represent estimated VS race time, not distance;
they exclude connecting routes. `rankTrackCombos` in `$lib/gp-combo-fit.ts` reuses the GP
Total 1 pair ratings, filters to available reference records with matching stats, and orders
unrounded scores with competition ranks. The page shows the top five distinct displayed ratings, numbered 1–5,
grouping pairs with the same displayed two-decimal rating into one row. Each rating groups
characters by kart, preserving valid pairs and individual calculator links with both IDs. Ratings retain full-catalogue normalization
(100 = best known pair), even if a database omits that pair. Unknown coverage or unmatched
stats show explicit empty states. Only source links accompany the terrain and recommendation data; explanatory copy is omitted.
Focused checks: `node --import tsx --test src/lib/track-setup.test.ts src/lib/gp-combo-fit.test.ts`.

## Data flow and code conventions

- `src/routes/+layout.svelte` imports global CSS, calls `setupConvex(convexUrl)`, mounts
  `ModeWatcher`, the toaster, and navbar, and gates page content on
  `convexStore.isLoaded` (while still allowing route errors to render).
- `convexStore` creates its own `ConvexClient` and fetches karts, characters, users,
  and tracks concurrently. These are initial query results, not subscriptions.
  Reference loading exposes `isLoading`, `error`, and guarded `loadData()` retries;
  success updates all four lists atomically, including empty lists.
  Feature pages use `useRecoverableQuery` from `$lib/use-recoverable-query.svelte`
  for live results and `useConvexClient().mutation(...)`
  for writes. Do not assume cached reference data refreshes after a mutation.
- `src/convex/convex.svelte.ts` also provides custom reactive `ConvexQuery` and
  `ConvexQueryPaginated` classes. Read their lifecycle before using them; most existing
  feature pages use the recoverable wrapper over the shared Convex client.
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

| Table                | Fields and relationships (besides Convex metadata)                                                |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `users`              | `name`                                                                                            |
| `tracks`             | `name`, `img`                                                                                     |
| `characters`         | Optional `name`, optional `img`                                                                   |
| `karts`              | `name`, `img`                                                                                     |
| `grandPrix`          | Numeric `order`, array of participant user IDs, optional `deletedAt` and `completedAt` timestamps |
| `grandPrixStandings` | GP ID, user ID, points                                                                            |
| `races`              | Numeric `order`, GP ID, start/end track IDs, `transition`                                         |
| `results`            | Race ID, user ID, optional/null position, optional character/kart IDs                             |

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
  terrain, water and gliding speed; acceleration, mini-turbo, coin curve, weight; road,
  terrain and water handling; traction and invincibility.
  Keep database names and dataset names aligned.
  The calculator uses a centered Bungee heading, responsive selection/art panel, combined-average
  table and horizontal grouped chart. Each combined average is `(character + kart) / 2` for one
  stat. The chart scale expands to include the selected values; missing datasets show dashes.
  The November 2026 sheet audit retained all 50 character entries and corrected Rally Bike/Hyper
  Pipe road handling to 6 and Funky Dorrie weight to 4 on the existing Lapita scale.
  The five additional stats use sheet values shifted to a zero minimum independently for each
  dataset. Character/kart baselines are gliding speed 10/0, mini-turbo 8/-4, coin curve 6/-3,
  traction 7/-2 and invincibility 5/-4. Existing eight-stat values and averaging stay unchanged.
  Off-road/rail/wall speed, gliding/off-road handling and stability are omitted because each
  is constant within both datasets. `calculatorStats` supplies the shared table/chart rows.
  Source: [The Mario Kart World Statpedia](https://docs.google.com/spreadsheets/d/1EQd2XYGlB3EFFNE-35hFLaBzJo4cipU9DZT4MRSjBlc/edit).
  Focused checks: `node --import tsx --test src/lib/data/StatsDataset.test.ts`.
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
- Use `bg-card` for boxed content, including bordered tables, summary tiles, and chart panels,
  matching Track Stats. Card surfaces are light gray (`#f9fafb`) in light mode and
  lighter charcoal (`#262626`) in dark mode; keep page backgrounds on `bg-background`.
- Brand utility `lapita` is `oklch(0.861 0.1695 92.73)` (bright yellow). Light primary
  is amber `#f59e0b`; dark primary is yellow `#f5cc24`. Light surfaces are white/gray;
  dark background is `#171717`, with `#262626` cards and `#404040` borders.
- `font-title` is Bungee for the logo/display identity; `font-body` is Oswald. General
  sans, serif, and mono tokens are Inter, Source Serif 4, and JetBrains Mono.
  Fonts load through Google Fonts in `src/app.html` and `src/app.css`.
- Base radius is `0.375rem`, spacing unit `0.25rem`, with subtle shared shadows.
  Cards, boxed panels, table containers, and page notices use `rounded-xl`, matching
  `Card.Root`; do not override cards with smaller corners. Inputs, buttons, and
  compact popovers use `rounded-md`; badges and focus outlines use `rounded-sm`.
  Keep circular markers circular and borderless tab strips square.
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
fully completed or manually completed GP. Scores are recomputed with `placementToPoints`, tied GP leaders each
receive a win unless a Knockout Tour winner is recorded, and rankings use competition places. Average finish requires ten races.
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

- Unreachable reads show a connection/retry state after 15 seconds. Check backend
  reachability, URL, dev proxy, and data; retry preserves current form entries.
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
`hasAllResults` or the manual `completedAt` override and requires a nonempty race list; winner filters include every tied first
place only for completed GPs. Track filtering matches either start or end of a transition.
Dates use the viewer's local calendar and include both boundary days. The navbar Grand Prix
link opens the archive; the home logo returns to the overview. Search and the homepage
Previous Grand Prix section also link to the archive. Run calculation checks with
`bun run tsx --test src/lib/gp-archive.test.ts`.

### Manual GP completion and shared wins

`grandPrix.completedAt` is an optional manual completion timestamp. The GP heading's
Mark complete control confirms ending a GP using valid recorded points, with missing
finishes worth zero; Undo manual completion clears the override. `gps.setComplete`
rejects missing/deleted GPs and requires races and participants. Results stay editable,
so later corrections can change winners. This does not fabricate results or complete
individual races. Home/archive status and ongoing forecasts respect the override.
`src/lib/grand-prix.ts` exports `summarizeGrandPrix`, shared by Records and player GP
wins (including combination wins), and archive winner filters. Otherwise, GP wins
require every participant's valid finish in every race; ties each earn a win. GP records
include manually completed scores, while race records still require completed races.
The player query returns `won` independently of the stored standing position for
combination attribution; the player overview reads GP wins directly from `records.get`.

The Stats page uses `records.stats` and `$lib/stats.ts` to aggregate active GP history on the
server. Race counts, points, podiums, averages, distributions and combination uses require
fully recorded participant races; results from outsiders and deleted GPs are excluded.
GP wins follow `summarizeGrandPrix`, including manual completion and shared firsts. The
wins-over-time chart shows cumulative totals by GP order, switches between GP wins and
race wins, and allows players to be hidden. Rates and averages have no minimum sample.
Charts include expandable data views; player comparison sorts by the selected metric.
GP activity groups non-deleted GPs by UTC creation month, includes ongoing GPs and fills
quiet months with zero. `$lib/gp-activity.ts` owns this aggregation; test with
`bun run tsx --test src/lib/gp-activity.test.ts`.
Focused tests: `bun run tsx --test src/lib/stats.test.ts`.

Page headings omit introductory subheadings. Keep supporting chart explanations, summary totals,
data notes, and loading/error recovery messages where they help users interpret the page.

### Grand Prix eras

`grandPrix.era` is an optional name (trimmed, up to 80 characters); each GP has one era.
The archive's Tag GP era control and the GP heading's Edit era control share
`SetEra.svelte`. `gps.setEra` applies or clears tags on existing, non-deleted GPs in an
inclusive positive-integer GP order range. It replaces prior tags, rejects empty ranges,
and never tags future GPs implicitly. Deleted GP tags are retained through restoration.
`gps.eraOptions` supplies existing names for reuse. Tags appear in the home history,
latest GP, archive and GP heading, linking to `/grandprix?era=<name>`; archive search also
matches era names. Era filters compose with other URL filters. No authentication is added.
Checks: `node --import tsx --test tests/gp-eras.test.ts src/lib/gp-archive.test.ts`.

The Stats wins-over-time chart shades contiguous GP ranges by era for both win metrics.
Player line colors remain independent. `records.stats` carries current era names in its
timeline; `$lib/gp-era-bands.ts` groups adjacent GP orders, leaving untagged or missing
GP numbers unshaded. Era names deterministically set band colors; repeated names reuse
colors. The legend names eras and GP ranges and links to the filtered archive. Tooltips
and the expandable data table also show eras. Bands use LayerChart's `belowMarks`
snippet and its live x scale; the domain extends half a GP beyond each endpoint so
single-GP eras stay visible. Tests: `node --import tsx --test src/lib/gp-era-bands.test.ts src/lib/stats.test.ts`.

Wins-over-time tooltips sort visible racers by their hovered win total, highest first,
for both GP wins and race wins. The shared `Chart.Tooltip` accepts an optional
`itemSorter` comparator; tooltips without it retain their existing series order.

### Recency-weighted xPoints

`results.stats` uses `$lib/race-forecast.ts` for per-racer track forecasts. The newest
10 valid finishes on that track each have weight 1; older finishes have weights
`0.9`, `0.81`, `0.729`, etc. (`0.9 ** (age - 9)` for zero-based ages 10 and above).
The weighted mean feeds the existing race-win model, so race xPoints comparisons,
starting/ongoing GP xPoints and win chances all use the same recency weighting.
The displayed historical `avg` remains unweighted; `weightedAvg` is separate.
Chronology is GP order, race order, then result creation time/ID; backfills of older
races do not displace recent races. Only integer finishes 1–24 count. Starting stats
still exclude the selected and later GP orders before weighting. Track selection
keeps the existing start=end matching, and deleted GPs remain excluded.
Checks: `node --import tsx --test src/lib/race-forecast.test.ts tests/starting-stats.test.ts`.


### Statistics definitions and labels

- **Scheduled races** count race documents, including empty and partial races.
- **Recorded finishes** count individual integer positions from 1–24, validated by
  `isValidFinishPosition` in `src/lib/grand-prix.ts`. Missing and invalid positions
  contribute neither a finish nor points. A race win means actual 1st place, not best
  among the group; podium means a top-three finish.
- **Fully recorded races** require a valid finish from every GP participant through
  `hasAllResults`. Stats and race Records use only these races, including those in
  ongoing GPs. Their rates and averages use each player's fully recorded race count.
  Records' average ranking requires ten such races; Stats has no minimum.
- **Completed GPs** require participants and at least one scheduled race, plus either
  all races fully recorded or `completedAt` set manually. `summarizeGrandPrix` computes
  scores from valid individual finishes, with missing finishes worth zero and tied
  leaders each credited a win. Manual completion does not make partial races fully
  recorded. Results remain editable. GP wins agree across profiles, Stats and Records.
- Profiles' overview, track averages, combinations and race history use individual
  recorded finishes, including partial races. Label sample counts **Recorded finishes**;
  do not call them completed races. Personal records follow Records rules, so their
  podium/streak counts can exclude finishes included in the profile overview.
- Track Stats counts scheduled races by end track, including transitions. Its
  **Avg. finishes / race** divides valid individual finishes by scheduled races,
  including empty ones. `summarizeTrackOverview` in `src/lib/track-stats.ts` supplies
  that query and shares finish validation with track detail and profiles. An unraced
  track has no average (`null`). Track detail's player and combination sample counts
  are recorded finishes; win rates divide wins by those finishes.
- Preserve intentional track grouping differences: profile combination best/worst
  tracks group by start track; other profile track stats and track pages use end
  track. GP historical averages/forecasts use only races whose start and end both
  match the track. Starting forecasts exclude the selected and later GP orders.
  Profile combination GP wins/points belong to the most-used combination in each GP;
  average GP points includes ongoing standings.
- GP points include individual recorded finishes; the fully recorded race progress
  remains separate from manual completion. Forecasts and xPoints are estimates based
  on current history, not stored pre-race predictions.
- `StatisticsHelp.svelte` provides a short scope statement and expandable definitions
  on each statistics surface. Keep common definitions there rather than adding
  repeated explanatory paragraphs. Deleted GPs are excluded and result edits can
  change historical totals.

Focused verification:

```bash
node --import tsx --test src/lib/track-stats.test.ts src/lib/stats.test.ts src/lib/records.test.ts
node --import tsx 'src/routes/players/[userId]/player-data.test.ts'
```


### Player directory

`/players` is linked from main navigation (active on profiles too) and site search’s
All players entry. It uses one live `users.directory` query with no arguments, returning
one row per user: `userId`, `name`, `raceCount`, `raceWins`, `gpWins`, `averageFinish`
(number or null), `characterId` and `kartId` (IDs or null). Reference art comes from the
shared cache; character and kart usage are counted independently, with ascending ID
breaking usage ties. Missing art falls back to a player icon / omitted kart.

`src/lib/player-directory.ts` aggregates valid integer finishes 1–24 in active GPs,
including partial races, for current GP participants. Activity means recorded race count;
race wins mean position 1; average finish uses those same recorded results with no minimum
sample size. GP wins reuse `summarizeGrandPrix`, including manual completion and tied
winners, recomputing source points rather than trusting standings. Deleted GPs and orphan
results are excluded. No history produces zero counts and null averages/choices.

The backend currently reads users, GPs, races and results once per query and returns only
summary rows (no per-player history requests). Name filtering and name/activity/race-win/
GP-win/average sorting run locally; missing averages stay last in either direction and
numeric ties sort by name then user ID. The compact table scrolls horizontally on narrow
screens. Head-to-head comparison links to the existing `/rivalry` route. Focused tests: `node --import tsx --test src/lib/player-directory.test.ts`.

### Track ownership

`/track-stats` offers Table (default) and Ownership grid (`?view=ownership`) views.
They share one `races.getStats` subscription and honor the legacy `track` filter.
`TrackOwnership.svelte` receives the filtered stats; switching views preserves URL
filters. `/track-ownership` redirects to the ownership grid for existing links.
The ownership grid reuses `races.getStats` and `summarizeTrackOverview`, whose
`userAverages` include each player's valid result `count`. End-track grouping,
integer finishes 1–24, partial races, and deleted-GP exclusions match Track Stats.
The minimum is fixed at five valid results per player per track (inclusive); it filters
eligibility before ranking, never the underlying history. Low-sample players stay
inspectable on tiles; unraced tracks remain visible with the all-player filter.
Leaders tie only on unrounded averages. An outright lead requires two eligible
players and a unique best average. Shared tracks count once overall and once per
tied player; sole eligible players are separate and earn no competitive lead.
The gap compares the two best eligible averages (zero for shared leads, unavailable
with fewer than two). Positive gaps below 0.01 display as `<0.01`. Player filtering
shows that player's eligible leading tracks without changing opponents or ranking.
Navbar links to Track Stats; site search opens its ownership grid directly. Tiles link to track detail.
`$lib/track-ranking.ts` owns the shared five-result eligibility rule. Track Stats
table leaders, player track-rival ranks/gaps, track-detail player rankings, profile
best/toughest highlights, and combination best/worst tracks enforce it. Smaller
samples remain visible as unranked; highlights with no eligible track show an
explicit empty state. Combination eligibility is per combination per start track;
other track eligibility uses end tracks.
The ownership share bar gives every shown track equal weight, splitting shared
tracks equally between their owners. Sole-eligible, low-sample and unraced tracks
form the unclaimed segment. This fractional bar allocation differs from the
whole shared-lead counts below it. Hover/focus reveals each segment's tracks;
expandable player lists provide the same links on touch screens. Introductory copy
is omitted from the grid; detailed rules and player totals live in a collapsed
“How ownership is counted” disclosure below the tiles. Selecting a
player segment filters tiles without recalculating the overall bar.
Focused tests: `node --import tsx --test src/lib/track-ownership.test.ts`.

### Completed Grand Prix recap

`/grandprix/[id]/recap` is a read-only completed-GP recap. The GP results page links
there and retains its existing detailed results. The homepage completed latest-GP card
adds View recap; if a newer GP is unfinished, `gps.latestCompleted` finds the most recent
completed active GP by GP order, beyond the loaded history page, and links to both views.
The query walks GPs in descending order using the existing indexes and stops at the first
completed GP; long runs of unfinished GPs may warrant a completion index in future.

`src/lib/gp-recap.ts` calculates standings from valid recorded finishes, using
`placementToPoints` and competition ranks (1,1,3), including every racer ranked 1–3
on the podium. Race wins count recorded first places, including multiple firsts.
Winning margin is zero for shared winners, the gap to second for a sole winner, and
unavailable for solo GPs. A manually completed GP with missing/invalid finishes uses
recorded sums under the existing completion rule, explicitly shows coverage, and withholds
comeback/lead-change highlights. Missing finishes are never represented as observed zeros. The recap no longer displays a
leader-gap chart; its replacement rates actual character/kart choices by track coverage.

The recap’s Combo ratings table includes each racer’s most-used character/kart pair and race
count. All equally used pairs appear with a tied label; only valid recorded finishes with both
choices count, including transitions and tracks without rating coverage. Missing choices stay unknown.
The shared recap PNG renderer shows most-used combos beneath racer names without repeated
labels or usage counts; shared characters are grouped and tied usage is marked. Compact 92px
standings rows are also used when calculating social-image dimensions.
The recap shows podium, standings, reconstructed comparisons and combo ratings. Highlights
and their definitions are not displayed. Keep supporting copy short: forecast descriptions in table-header titles, essential missing-data notices, and optional rating-method details. No explanatory paragraph under standings.
The calculation helper retains tested comeback and lead-change data for other consumers.
`src/lib/recap-image.ts` creates a local PNG when the image preview is opened, including every racer,
points, wins, xPoints, signed actual-minus-xPoints, starting win chances, kart/character/combined ratings and a completeness notice. It uses the same calculated
rows as the page and never publishes or sends data. The 1200px-wide export has a yellow
Bungee banner with the Lapita logo in a diagonal charcoal panel, medal podium cards (including shared places),
and one compact table combining standings and all three ratings. Height grows with podium
rows and participants; long names shrink then ellipsize rather than overlap. Load Bungee and
Inter weights before drawing, falling back if fonts fail. `renderRecapImage` is a separate
synchronous canvas renderer so the exact export can be visually checked in a native canvas
runtime; `createRecapImage` loads fonts and the local logo and returns a PNG blob. The image button
opens a responsive Dialog preview with an icon Copy button over the image’s top-right corner
and a Download-only footer; no instructional text below the image. The overlay is not part
of the exported PNG; it does not
automatically download. Clipboard writes happen only on the Copy image click and copy the PNG blob, not its URL.
The button shows a pending spinner, then a checked yellow success state for 2.5 seconds
and an “Image copied” toast only after the write succeeds. Unsupported or denied writes
show a clear error, with a
right-click/long-press fallback when unsupported or denied. Preview object URLs are revoked
on replacement and unmount. The logo is drawn fully inside the header at 170×170 (1000,10). The image has no footer notes or podium/margin headings. Show the conditional missing-results
notice beside Standings, and keep source/forecast explanations on the page.
Image preview generation waits for forecast requests;
failed/unavailable forecasts show dashes.

Standings combine xPoints with signed actual-minus-xPoints in parentheses in one column using `calculatePointsComparison`
from the detailed GP page and `results.stats`. These compare only recorded finishes using
current track history, including the GP itself. The “Win chance” column separately uses
`results.stats` with `beforeGrandPrixId` and the shared `calculateStartingGpOutlook`, treating
all scheduled races as unplayed and excluding the selected/later GP orders from history.
It is the same repeatable 5,000-trial model as the GP starting-stats table. Tied winners
all count, so percentages can sum above 100%. Both forecasts are reconstructed, not saved
snapshots, and have independent loading/error/retry states; insufficient history shows dashes.

`src/lib/gp-combo-fit.ts` scores each participant's actual recorded character/kart per race.
`src/lib/data/trackCoverage.json` snapshots The Mario Kart World Statpedia's 30 VS main-track
coverage estimates (retrieved 2026-11-12, source date text 12/09/2026), keeping the source
URL and the explicit Wario Shipyard → Wario's Galleon alias. Rough maps to terrain speed.
`src/lib/data/total1Model.json` snapshots The Mario Kart World Statpedia's actual Classic Races Total 1 formula
(`Combo Rankings WIP!AG6:AJ6`), coefficients, source-level offsets and three reference fixtures.
`calculateTotal1` adds log-speed with a coin-curve multiplier (scale 70000), diminishing-return
handling (`1-exp(-0.05*level)`, scale 18.39, coverage multiplier 40 and road multiplier 1.3),
and linear bonuses (acceleration 65, mini-turbo 12, weight 8, invincibility 4 per source level).
The actual source cells use 70000; The Mario Kart World Statpedia's descriptive note lists a different value, so
follow the tested cells. Each track replaces The Mario Kart World Statpedia's Classic Races average road, rough,
water, gliding and neutral coverage. Coin curve affects neutral speed too. Traction is excluded.
This replaces the earlier custom 70/30 model; it remains a WIP heuristic, not measured performance.

Restore the zero-based local datasets to source stat levels using the separate character/kart
offsets, then sum source levels before applying nonlinear formulas. Do not average levels or
normalize individual stats first. Retain the local dataset's current stat values; this adaptation
does not overwrite calculator data. Normalize full-pair totals to 0–100 across all pairs per
track. Character/kart ratings first average raw full-pair totals across all opposite partners,
then normalize within the corresponding catalogue. They are average-partner ratings, not a
separate source formula for a standalone component.

GP ratings average available races equally using actual recorded choices. The page and PNG
show Kart /100, Character /100 and Combined /100, sorted by combined score. Rated-race counts, setup counts/stints and kart-change counts
are not displayed. Per-race details retain recorded names, all three ratings and coverage/status.
A known component can be rated when the other is missing, so the three GP averages may use
different race samples. Missing/unknown components or stats, uncovered tracks, and transition
routes remain unrated, not zero. Combined requires both components. Only valid integer finishes
1–24 establish observed usage; missing choices are never copied from another race.


Focused tests:
`node --import tsx --test src/lib/gp-combo-fit.test.ts src/lib/gp-recap.test.ts tests/gp-recap-latest.test.ts`.
Run the shared forecast tests with `node --import tsx 'src/routes/grandprix/[id]/gp-outlook.test.ts'`
and `node --import tsx 'src/routes/grandprix/[id]/expected-points.test.ts'`.

### Personal progress

Keep the default progress view compact: one card with overall and equal-weight shared-track
changes, a short brand-yellow trend chart, and the three largest shared-track changes with
track art (only the largest change is shown on mobile). Green means better (lower finishes), rose means worse, and text/icons retain the
meaning without colour. Keep full comparisons, win rate, average points, methodology and
accessible chart data behind “All results and chart data”; period controls expand through
“Change period”. Do not restore the stacked full-table layout in the default overview.

Player Overview includes `PersonalProgress.svelte` alongside the existing profile sections.
The default compares the latest 10 eligible GPs with up to 10 preceding eligible GPs;
`progressSize=1|5|10|20` and optional inclusive `progressThrough=<GP order>` live in the
URL, with `#personal-progress` for sharing. Invalid URL values fall back to 10/latest.
A one-GP period supports players with only two eligible GPs. Periods never overlap or
rebalance; missing previous history is explicitly unavailable, not zero.

Eligibility follows profile rules: an undeleted GP where the player is a participant
with at least one valid individual recorded finish (integer 1–24). Ongoing and manually
completed GPs count; missing results earn neither a finish nor points in these averages.
GP order defines chronology. Overall averages weight each recorded finish equally;
race wins mean actual first place, win rate divides by recorded finishes, and average
points per race uses `placementToPoints` over those finishes. All sample counts are
shown. Track comparisons use end tracks, including transitions. The shared-track
comparison averages track means with equal weight per shared track in both periods,
so changing track frequency cannot itself create an improvement. It does not adjust
for attendance, opponents or other conditions and is not a skill rating.

`results.personalProgress` queries the GP order index, skips deleted/nonparticipant
GPs, and reads only that player's results through `raceIdAndUserId`. It stops after
two periods, scans at most 500 GP documents, and reports truncation with guidance to
select an earlier upper bound. It does not add a full player-history query. The trend
shows per-GP average finishes and provides an expandable data table with GP creation
dates, period labels and counts. Loading/error/retry and insufficient-history states
are local to the section. Calculations and URL parsing live in
`src/lib/personal-progress.ts`. Verify with:

```bash
node --import tsx --test src/lib/personal-progress.test.ts tests/personal-progress-query.test.ts
```

### Head-to-head rivalry

`/rivalry` stores both player IDs (`a`, `b`) and the scope in the URL. Selectors
reject identical players; missing/stale IDs prompt a new selection without querying.
Profiles offer Compare rivalry with that player preselected; the Players directory
and site search link to the comparison. Scope is all time or the latest 5/10/20
non-deleted GPs globally by GP order, including GPs in progress and those without
both players. Invalid scope values fall back to all time. Back/forward navigation
restores selectors and resets the recent-results display to 12 rows.

`rivalry.get` uses the existing `results.userId` indexes to intersect race IDs and
`grandPrix.order` for recent scopes. It checks both users exist and differ, excludes
deleted/missing GPs, missing races and nonparticipants, then passes paired finishes
to `src/lib/rivalry.ts`. Only races where both finishes are integers 1–24 count;
other participants may still have missing results. All metrics use this same sample.
Head-to-head percentage is finishes ahead / shared races × 100. Equal finishes count
as ties and give neither player a win, but remain in both denominators; the two
percentages can total less than 100%. Empty samples have null averages/percentages
and zero counts/points. Points use `placementToPoints`, independent of standings.

The shared chart/table components show cumulative finishes ahead in GP/race order
(ties leave both lines unchanged), recent paired finishes with race-selected GP
links, and end-track advantages with sample sizes. Track advantage means the
absolute difference in finishes ahead, labelled with the leading player; equal
counts are Level. Transitions group by end track. Recent history reveals 12 more
rows per click. All-time queries currently read both players' full result histories;
no additional schema indexes are needed.

`StatisticsHelp.svelte` has a rivalry scope for shared-sample and tie definitions.
Query failures offer an in-place retry through `useRecoverableQuery`, preserving
the selected players and scope.

Focused verification:
`node --import tsx --test src/lib/rivalry.test.ts tests/rivalry-query.test.ts`.

## Loading and error recovery

`QueryResource` (`src/lib/query-resource.ts`) owns read timeouts, retry generations,
retained results, and subscription cleanup. `useRecoverableQuery` creates one live
subscription per reactive argument set; call it once with an argument getter, using
`'skip'` until dependencies exist. Check errors before loading, distinguish undefined
from empty results, and call `.retry()` without remounting forms. A 15-second initial
read timeout shows recovery controls while keeping the subscription alive for automatic
reconnection. The root connection notice also retains page content during outages.

The GP server loader bounds its initial lookup with `readWithTimeout`, closes its
client, and returns a friendly 503 on connection failure. The GP race selector
validates `?track=` against the current GP, falling back to its
first race by order. URL repair replaces history and preserves other parameters and
the hash. An empty race list has a separate empty state. Standings, recorded results,
track forecasts, and starting forecasts recover independently; forecast failures never
gate result entry. A missing live GP shows an unavailable state. Mutation errors use
friendly copy, keep selections, and never retry writes automatically. Track editing
locks duplicate saves and keeps the dialog open after failure. Reduced-motion users
get a static loading logo and no GP chart tweens; CSS motion is reduced globally.

Focused read-only regressions:

```bash
node --import tsx --test src/lib/query-resource.test.ts
node --import tsx 'src/routes/grandprix/[id]/race-selection.test.ts'
```

### GP link previews

Both `/grandprix/[id]` and `/grandprix/[id]/recap` include Open Graph and Twitter
large-image metadata in the initial HTML via `src/hooks.server.ts`. These pages keep
`ssr = false`; client-only `<svelte:head>` content is insufficient for link unfurlers.
The hook only handles document GET/HEAD requests for these two routes, leaves data
requests alone, and lets the existing app load if preview metadata cannot be fetched.
`src/lib/gp-embed.ts` escapes all attribute values and shares image dimensions with
`recapImageSize`. Both page URLs point to the same absolute `/grandprix/[id]/recap.png`
image URL; race-selection query parameters do not alter the GP preview.

The PNG endpoint uses the same `renderRecapImage`, recorded scores, forecasts, ratings,
and logo as the modal. `src/lib/server/gp-share.ts` reads Convex through its server URL;
missing or deleted GPs and unfinished recaps do not return a recap PNG. Unfinished GP
metadata uses the Lapita logo. Manual completion remains explicit in metadata/image.
Forecast failures produce dashes rather than fabricated estimates. The native server
renderer uses `@napi-rs/canvas` with locally bundled Bungee/Inter fonts and their OFL
licenses in `src/lib/server/recap-assets/`; logo/fonts are imported and read through
`$app/server` so Docker needs no fonts service or request back to the public app URL.
The adapter-node production dependency install includes the native canvas package.

Image requests recheck GP availability/completion before using a bounded 24-entry,
60-second render cache. PNG responses use ETags and a 60-second public HTTP cache;
source edits change the image on refresh, while chat services may keep their own
cached preview longer. Public link unfurlers must be able to reach the deployed app
and its image endpoint: a private VM IP/localhost link cannot unfurl outside its network.
Set the normal adapter-node public `ORIGIN` correctly behind the deployment proxy.
No preview is posted or sent automatically. Tests:
`node --import tsx src/lib/gp-embed.test.ts` plus a production HTTP smoke check of both
HTML routes, the PNG content type/dimensions, missing-image 404s, and ETag 304 responses.
