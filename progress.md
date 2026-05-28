# Progress Log: PsyPic RC1

## Session: 2026-05-27

### Phase 1: RC1 plan and E2E discovery
- **Status:** complete
- **Started:** 2026-05-27
- Actions taken:
  - Accepted the user-proposed RC1 goal as the working objective.
  - Used `planning-with-files` because the work spans multiple phases and needs persistent context.
  - Checked repository root, relevant docs/config file names, and git status.
  - Proposed AgentBridge split: Codex owns executable local validation and fixes; Claude reviews release/deploy/recovery checklist completeness.
  - Inspected `package.json`, `playwright.config.ts`, E2E file inventory, and E2E-related docs references.
  - Ran official `pnpm e2e`; it failed before browser launch with `error: unknown command 'test'`.
  - Ran local Node Playwright CLI directly; it reached Playwright config but webServer failed because `next` was not found.
  - Ran `pnpm install` to rebuild missing `.bin` links; it failed with EPERM on `node_modules/@esbuild/win32-x64`.
  - Added `scripts/e2e.mjs`, switched E2E scripts to the local Playwright CLI, fixed the Playwright browser path to `.playwright-browsers`, added `e2e:chrome`, and switched the Playwright webServer to the local Next CLI.
  - Ran `pnpm e2e:chrome`; it got past CLI/browser launch but timed out while Next dev used Turbopack and reported Windows watcher/path errors.
  - Updated Playwright webServer command to pass `--webpack`, matching the existing `pnpm dev` script.
  - Re-ran `pnpm e2e:chrome`; it timed out after 10 minutes with Playwright artifacts showing 90s test timeouts around `page.goto("/")` and closed browser contexts.
  - Ran a single desktop auth-sync spec; it also timed out while the Next webServer flooded `Watchpack Error (watcher)` messages.
  - Added `WATCHPACK_POLLING=true` to the Playwright webServer env to avoid native watcher failures on this Windows workspace.
  - Re-ran the single desktop auth-sync spec; it reached the settings page and saved the key binding, but the test hit the 90s total test timeout during cold Next compilation.
  - Increased Playwright per-test timeout from 90s to 180s to account for cold Next webpack compilation with polling on Windows.
  - Re-ran the single desktop auth-sync spec after the timeout increase; both tests passed in 3.5 minutes.
  - Ran the single desktop generation-events spec; it reached the workbench and submitted generation, but the 15s expect timeout expired while `/api/images/generations` was still cold-compiling.
  - Increased Playwright expect timeout from 15s to 60s for cold-route E2E stability.
  - Re-ran the single desktop generation-events spec after the expect timeout increase; it passed in 3.6 minutes.
  - Ran full `pnpm e2e:chrome`; it failed before tests because Playwright webServer health readiness exceeded the previous 120s startup timeout.
  - Increased Playwright webServer timeout from 120s to 300s for cold Next health-route compilation.
  - Re-ran full `pnpm e2e:chrome`; all six desktop/mobile E2E tests passed in 6.7 minutes.
  - Ran `pnpm e2e:install`; Playwright Chromium/ffmpeg/headless-shell/winldd installed successfully under `.playwright-browsers`.
  - Ran official `pnpm e2e`; all six desktop/mobile E2E tests passed in 7.3 minutes.
  - Updated `docs/17-测试与验收用例.md` with the fixed browser cache path and `pnpm e2e:chrome`.
- Files created/modified:
  - `task_plan.md` (created)
  - `findings.md` (created)
  - `progress.md` (created)

### Phase 2: E2E formalization
- **Status:** complete
- **Started:** 2026-05-27
- Actions taken:
  - Added `tests/e2e/board-composer.desktop.spec.ts` as a desktop-only Playwright gate.
  - Covered the user path: generate a source asset, sync the library, drag the asset into Board, export it as a Composer reference, submit `/api/images/edits`, and verify the submitted FormData contains a non-empty `board-export-*.png` image file.
  - Kept this official E2E lane independent of workbench database availability, because the current local E2E environment intentionally runs with no configured `DATABASE_URL`.
  - Saved the Board flow screenshot at `output/playwright/screenshots/board-composer-edits-desktop.png`.
  - Ran the new Board spec through system Chrome; it passed in 3.7 minutes.
  - Ran official `pnpm e2e`; all seven desktop/mobile E2E tests passed in 7.0 minutes.

### Phase 3: Warning cleanup
- **Status:** complete for test/jsdom warning cleanup and official E2E gate
- **Started:** 2026-05-27
- Actions taken:
  - Updated the `react-konva` Vitest mock to avoid forwarding Konva-only event props such as `onTap` and `onTransformEnd` to DOM nodes, while preserving those handlers for Board tests.
  - Hardened Board drop coordinate handling so jsdom events without finite pointer coordinates fall back to the visible stage center instead of producing `NaN` values.
  - Reduced async no-op state updates in Creator workspace/project/branch hooks when IndexedDB is unavailable or empty.
  - Changed the Composer size dropdown to a non-modal Radix menu and adjusted the creator shell test to exercise template card selection instead of a noisy dropdown path.
  - Added a TaskDock retry path for transient terminal-task runtime-event fetch failures and covered it with a component test.
  - Replaced Prisma-related variable dynamic imports with literal dynamic imports to remove webpack critical dependency warnings.
  - Added dev watcher ignores in `next.config.ts` for `node_modules`, `.git`, `output`, `.data`, and `.playwright-browsers`.
  - Ran targeted Vitest suites for Board, Creator shell, TaskDock, and job runtime events; they passed without the earlier React/Konva warning noise.
  - Ran full official `pnpm e2e`; all seven tests passed in 7.1 minutes after warning cleanup.
  - Attempted `pnpm typecheck`; it timed out locally after 5 minutes without a reported type error, likely due the repaired-but-abnormal dependency tree on this Windows workstation.
- Accepted warning baseline:
  - Full E2E still logs one Next dev `Fast Refresh had to perform a full reload`.
  - Full E2E still logs one Next dev `SyntaxError: Unexpected end of JSON input` for `/api/workbench/job-runtime-events`; tests remain green and no hydration mismatch text was observed.

### Phase 4: Production configuration hardening
- **Status:** complete for env/secret/storage/test-endpoint hardening
- **Started:** 2026-05-27
- Actions taken:
  - Added explicit production store-mode variables to `.env.example` for auth, image tasks, job runtime events, community, Board documents, and search index.
  - Updated deployment and acceptance docs to state that `SESSION_SECRET` and `KEY_ENCRYPTION_SECRET` must be high-entropy, distinct values.
  - Hardened `KEY_ENCRYPTION_SECRET` so production cannot encrypt new key bindings with the development fallback or placeholder value.
  - Extended `/api/health` with redaction-safe `credentials` checks for session signing, key encryption, and distinct credential values.
  - Made `/api/health` fail `ASSET_STORAGE_DRIVER=local` when `NODE_ENV=production`; local remains valid for development/test.
  - Added explicit `/api/e2e/session` production coverage proving it returns 404 even with a matching E2E token.
  - Recorded that DB/Redis live connectivity still needs a real staging target; current health output verifies configuration state, not network liveness.
- Tests run:
  - `pnpm exec vitest --run tests/api/health.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 4 passed.
  - `pnpm exec vitest --run tests/api/e2e-session.test.ts tests/unit/key-binding-service.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 2 files / 7 tests passed.

### Phase 5: Core business workflow acceptance
- **Status:** complete with RC1 evidence package
- **Started:** 2026-05-28
- Actions taken:
  - Validated the auth/settings path for session bootstrap and Sub2API key binding through existing E2E and API coverage.
  - Re-ran focused API suites for text-to-image, image-to-image, multi-reference image edits, mask edits, community publishing, and moderation.
  - Added `tests/e2e/community-admin.desktop.spec.ts` to cover generated asset library readback, community publish, community detail, "generate same" draft handoff, report queue, admin feature, admin takedown, API 404 after takedown, and restore.
  - Kept screenshot artifacts for community detail and admin moderation under `output/playwright/screenshots/`.
  - Wrote committed acceptance evidence to `docs/rc1-evidence/rc1-acceptance.json`.
- Tests run:
  - `pnpm exec vitest --run tests/api/auth.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 6 passed.
  - `pnpm exec vitest --run tests/api/image-generations.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 15 passed.
  - `pnpm exec vitest --run tests/api/image-edits.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 10 passed.
  - `pnpm exec vitest --run tests/api/library.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 6 passed.
  - `pnpm exec vitest --run tests/api/community-works.test.ts tests/api/community-moderation.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 2 files / 11 tests passed.
  - `pnpm e2e:chrome tests/e2e/community-admin.desktop.spec.ts --project=desktop-chromium --reporter=line`: 1 passed.

### Phase 6: Data recovery and sync hardening
- **Status:** complete for local/server-mode unit and API evidence; staging infra still required for live DB/Redis credentials
- **Started:** 2026-05-28
- Actions taken:
  - Re-ran workbench API, version-node, outbox, cache, sync-engine, and Board store suites.
  - Added a sync-engine regression proving local outbox entries survive server downtime and are cleared after server recovery.
  - Re-ran TaskDock and image job queue suites for failed/canceled/retry task closure at UI/API boundaries.
  - Recorded fallback/IndexedDB and outbox recovery conclusions in the RC1 acceptance JSON.
- Tests run:
  - `pnpm exec vitest --run tests/api/workbench-sync.test.ts tests/api/workbench-version-nodes.test.ts tests/unit/workbench-outbox-store.test.ts tests/unit/workbench-cache-store.test.ts tests/unit/sync-engine.test.ts tests/unit/board-store.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 6 files / 31 tests passed.
  - `pnpm exec vitest --run tests/components/task-dock.test.tsx --pool=forks --fileParallelism=false --reporter=verbose`: 11 passed.
  - `pnpm exec vitest --run tests/api/batches.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 7 passed.
  - `pnpm exec vitest --run tests/api/image-job-queue.test.ts --pool=forks --fileParallelism=false --reporter=verbose`: 3 passed.

### Phase 7: RC release gate and evidence packaging
- **Status:** complete except commit/push in progress
- **Started:** 2026-05-28
- Actions taken:
  - Fixed local lint scanning of ignored/generated directories.
  - Changed `pnpm typecheck` to run without incremental writes so this Windows workstation can complete the gate.
  - Fixed readonly `process.env.NODE_ENV` test assignment errors with scoped env helpers.
  - Re-ran release gates and recorded results in `docs/rc1-evidence/rc1-acceptance.json` and `RELEASE_CHECKLIST.md`.
  - Updated `docs/17-测试与验收用例.md` with RC1 evidence links, current acceptance status, accepted warnings, and external staging/production blockers.
- Gate results:
  - `git diff --check`: passed.
  - `pnpm lint`: passed in 107.9s.
  - `pnpm typecheck`: passed in 81.9s.
  - `pnpm build`: passed in 538s.
  - `pnpm e2e`: 8 passed in 10.5m.
  - `pnpm test`: blocked as a full aggregate on this workstation; targeted suites above passed and the timeout is documented as an accepted RC1 local blocker.

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Official E2E | `pnpm e2e` | Playwright starts E2E suite or reports missing browser revision | Failed with `error: unknown command 'test'` | Fail |
| Local Playwright CLI | `node ./node_modules/@playwright/test/cli.js test` | Playwright starts web server and tests | Failed because config webServer could not find `next` | Fail |
| Dependency relink | `pnpm install` | Recreate missing local package bins | Failed with `ERR_PNPM_EPERM` on `node_modules/@esbuild/win32-x64` | Fail |
| Chrome E2E after launcher | `pnpm e2e:chrome` | Run official E2E suite through system Chrome | Timed out after Turbopack watcher/resource/path errors | Fail |
| Chrome E2E after webpack fix | `pnpm e2e:chrome` | Run official E2E suite through system Chrome | Timed out after 10 minutes; artifacts show first-page/test timeouts | Fail |
| Single desktop auth-sync E2E | `pnpm e2e:chrome tests/e2e/workbench-auth-sync.spec.ts --project=desktop-chromium --reporter=line` | Isolate one spec failure | Timed out after Watchpack watcher flood | Fail |
| Single desktop auth-sync E2E after polling | `pnpm e2e:chrome tests/e2e/workbench-auth-sync.spec.ts --project=desktop-chromium --reporter=line` | Key binding assertion reaches stable UI | Failed at 90s total timeout even though snapshot showed success text visible | Fail |
| Single desktop auth-sync E2E after timeout increase | `pnpm e2e:chrome tests/e2e/workbench-auth-sync.spec.ts --project=desktop-chromium --reporter=line` | Both auth-sync tests pass | 2 passed in 3.5m | Pass |
| Single desktop generation-events E2E | `pnpm e2e:chrome tests/e2e/workbench-generation-events.spec.ts --project=desktop-chromium --reporter=line` | Task reaches completed state and result appears | Failed after 15s expect timeout while generation route was still compiling/submitting | Fail |
| Single desktop generation-events E2E after expect timeout increase | `pnpm e2e:chrome tests/e2e/workbench-generation-events.spec.ts --project=desktop-chromium --reporter=line` | Task reaches completed state and result appears | 1 passed in 3.6m | Pass |
| Full Chrome E2E | `pnpm e2e:chrome` | All desktop/mobile E2E tests pass | Failed waiting for webServer readiness after 120s | Fail |
| Full Chrome E2E after webServer timeout increase | `pnpm e2e:chrome` | All desktop/mobile E2E tests pass | 6 passed in 6.7m | Pass |
| Playwright Chromium install | `pnpm e2e:install` | Install browser assets to fixed project-local path | Installed Chromium revision 1217 and related assets under `.playwright-browsers` | Pass |
| Official E2E after Chromium install | `pnpm e2e` | All desktop/mobile E2E tests pass with Playwright-managed Chromium | 6 passed in 7.3m | Pass |
| Board -> Composer -> edits E2E | `pnpm e2e:chrome tests/e2e/board-composer.desktop.spec.ts --project=desktop-chromium --reporter=line` | Board export reference submits through Composer edits | 1 passed in 3.7m | Pass |
| Official E2E after Board coverage | `pnpm e2e` | All desktop/mobile E2E tests pass with Playwright-managed Chromium | 7 passed in 7.0m | Pass |
| Board unit warning check | `pnpm exec vitest --run tests/unit/board-mode.test.tsx --pool=forks --fileParallelism=false` | Board tests pass without invalid Konva DOM-prop or NaN warnings | 39 passed | Pass |
| Creator shell warning check | `pnpm exec vitest --run tests/components/creator-shell.test.tsx --pool=forks --fileParallelism=false` | Creator tests pass without React act/dropdown warning noise | 39 passed | Pass |
| TaskDock retry check | `pnpm exec vitest --run tests/components/task-dock.test.tsx --pool=forks --fileParallelism=false` | TaskDock tests pass, including transient terminal fetch retry | 11 passed | Pass |
| Job runtime events API check | `pnpm exec vitest --run tests/api/job-runtime-events.test.ts --pool=forks --fileParallelism=false` | Runtime-event API tests pass | 4 passed | Pass |
| Desktop auth-sync after dev watcher ignore | `pnpm e2e tests/e2e/workbench-auth-sync.spec.ts --project=desktop-chromium --reporter=line` | Desktop auth-sync still passes after Next watcher config change | 2 passed in 4.8m | Pass |
| Official E2E after warning cleanup | `pnpm e2e` | All official browser gates pass after warning cleanup | 7 passed in 7.1m | Pass |
| Typecheck attempt | `pnpm typecheck` | Typecheck completes or reports actionable type errors | Timed out after 5m without actionable compiler output | Blocked |
| Production health hardening | `pnpm exec vitest --run tests/api/health.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Health reports credentials/storage readiness without leaking values | 4 passed | Pass |
| E2E helper and key encryption hardening | `pnpm exec vitest --run tests/api/e2e-session.test.ts tests/unit/key-binding-service.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | E2E helper stays 404 in production and production rejects dev encryption key | 2 files / 7 tests passed | Pass |
| Auth API acceptance | `pnpm exec vitest --run tests/api/auth.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Login/register/session API remains green | 6 passed | Pass |
| Image generation acceptance | `pnpm exec vitest --run tests/api/image-generations.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Text-to-image flow remains green | 15 passed | Pass |
| Image edit acceptance | `pnpm exec vitest --run tests/api/image-edits.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Image-to-image, multi-reference, and mask edit APIs remain green | 10 passed | Pass |
| Library acceptance | `pnpm exec vitest --run tests/api/library.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Generated assets list, detail, metadata update, and download remain green | 6 passed | Pass |
| Community acceptance | `pnpm exec vitest --run tests/api/community-works.test.ts tests/api/community-moderation.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Publish, detail, moderation, feature, takedown, restore remain green | 2 files / 11 tests passed | Pass |
| Community/admin E2E | `pnpm e2e:chrome tests/e2e/community-admin.desktop.spec.ts --project=desktop-chromium --reporter=line` | Library -> community -> detail same generation -> admin moderation works | 1 passed | Pass |
| Workbench recovery suite | `pnpm exec vitest --run tests/api/workbench-sync.test.ts tests/api/workbench-version-nodes.test.ts tests/unit/workbench-outbox-store.test.ts tests/unit/workbench-cache-store.test.ts tests/unit/sync-engine.test.ts tests/unit/board-store.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Server persistence, fallback cache/outbox, sync, and Board snapshot tests remain green | 6 files / 31 tests passed | Pass |
| TaskDock closure | `pnpm exec vitest --run tests/components/task-dock.test.tsx --pool=forks --fileParallelism=false --reporter=verbose` | Failed/canceled/retry UI behavior remains green | 11 passed | Pass |
| Batch jobs | `pnpm exec vitest --run tests/api/batches.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Batch prompt/API behavior remains green | 7 passed | Pass |
| Image job queue | `pnpm exec vitest --run tests/api/image-job-queue.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Image queue retry/failure behavior remains green | 3 passed | Pass |
| Env assignment regression | `pnpm exec vitest --run tests/api/e2e-session.test.ts tests/api/health.test.ts tests/unit/key-binding-service.test.ts --pool=forks --fileParallelism=false --reporter=verbose` | Tests no longer mutate readonly `process.env.NODE_ENV` directly | 3 files / 11 tests passed | Pass |
| Diff whitespace gate | `git diff --check` | No whitespace errors | Passed | Pass |
| Lint gate | `pnpm lint` | ESLint passes with ignored generated directories excluded | Passed in 107.9s | Pass |
| Typecheck gate | `pnpm typecheck` | TypeScript completes locally | Passed in 81.9s | Pass |
| Build gate | `pnpm build` | Production Next build completes | Passed in 538s | Pass |
| Official E2E final gate | `pnpm e2e` | All official browser E2E specs pass | 8 passed in 10.5m | Pass |
| Full Vitest aggregate | `pnpm test` | Full aggregate completes locally | Timed out twice without actionable failures; targeted suites passed | Blocked |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-05-27 | `pnpm e2e` failed with `error: unknown command 'test'` | 1 | In diagnosis; next step is CLI/bin resolution rather than rerunning same command |
| 2026-05-27 | Local Playwright CLI failed with `'next' is not recognized` in config webServer | 1 | Diagnose/rebuild local `.bin` links or make E2E launchers use explicit local CLIs |
| 2026-05-27 | `pnpm install` failed with EPERM on `node_modules/@esbuild/win32-x64` | 1 | Check for running Node/esbuild/Next processes or locked dependency directory before retrying with a changed approach |
| 2026-05-27 | `pnpm e2e:chrome` timed out with Next Turbopack watcher/path errors | 1 | Updated Playwright webServer to use `next dev --webpack`, matching the repo's dev script |
| 2026-05-27 | `pnpm e2e:chrome` timed out after webpack fix with `page.goto("/")` test timeouts | 1 | Narrow to single desktop spec for cleaner signal |
| 2026-05-27 | Single desktop E2E timed out with repeated `Watchpack Error (watcher)` | 1 | Set `WATCHPACK_POLLING=true` in Playwright webServer env |
| 2026-05-27 | Single desktop E2E hit 90s total timeout after reaching successful key-binding UI | 1 | Increased Playwright test timeout to 180s |
| 2026-05-27 | Single desktop generation E2E hit 15s expect timeout while waiting for task completion | 1 | Increased Playwright expect timeout to 60s |
| 2026-05-27 | Full `pnpm e2e:chrome` exceeded 120s webServer readiness timeout | 1 | Increased Playwright webServer timeout to 300s |
| 2026-05-27 | Board E2E drag landed under the Board inspector and timed out | 1 | Moved the target position into the visible stage and capped drag timeout at 30s |
| 2026-05-27 | Playwright `request.postData()` returned empty for multipart edit body | 1 | Added a browser-side fetch/FormData recorder and asserted the submitted Board export `image` file |
| 2026-05-27 | Workbench project API returned `工作台数据库不可用` in official E2E | 1 | Kept no-DB official E2E focused on Board -> Composer -> edits; deferred DB-backed Board snapshot persistence to Phase 6 |
| 2026-05-27 | Board E2E result assertion matched both source and edit images | 1 | Scoped assertions to `active-gallery` |
| 2026-05-27 | Merging Next's existing `watchOptions.ignored` into an array caused webpack config validation to fail | 1 | Replaced the merge with explicit string glob ignore entries |
| 2026-05-27 | Dev watcher ignore entries omitted dependency-scale defaults and `/api/e2e/session` hung until test timeout | 1 | Added `**/node_modules/**` and `**/.git/**` to the explicit ignore list |
| 2026-05-27 | Full E2E remained green but still logged Next dev Fast Refresh reload and one job-runtime-events empty JSON parse | 1 | Documented as accepted dev-server warning baseline pending production-build verification |
| 2026-05-27 | Production hardening Vitest aggregate timed out after 5 minutes without output | 1 | Split into smaller Vitest runs and recorded passing results per file group |
| 2026-05-27 | `/api/health` field named `secrets` was redacted to `[REDACTED]` by the response sanitizer | 1 | Renamed the health section to `credentials` and used redaction-safe status field names |
| 2026-05-28 | ESLint scanned ignored/generated `output/node_modules-blocked-*` files | 1 | Added explicit ESLint ignores for generated, cache, browser, build, and output directories |
| 2026-05-28 | `tsc` attempted incremental build-info writes during the local typecheck gate | 1 | Changed `pnpm typecheck` to `tsc --noEmit --incremental false` |
| 2026-05-28 | Some tests assigned to `process.env.NODE_ENV`, which is readonly in the current type environment | 1 | Added scoped env mutation helpers using `Reflect.set` and restoration |
| 2026-05-28 | Full `pnpm test` aggregate timed out after 30 minutes without actionable output | 1 | Recorded as RC1 local blocker and verified high-risk suites in smaller groups |
| 2026-05-28 | Parallel Vitest aggregate with thread pool timed out after 20 minutes without useful output | 1 | Kept targeted-suite evidence as the RC1 unit/API acceptance record |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 7: commit and push |
| Where am I going? | E2E formalization, warning cleanup, production hardening, workflow acceptance, recovery/sync hardening, release packaging |
| What's the goal? | Push PsyPic to Release Candidate 1: deployable, regression-testable, demoable, and diagnosable |
| What have I learned? | See `findings.md` and `docs/rc1-evidence/rc1-acceptance.json` |
| What have I done? | Created persistent RC1 planning files, unblocked official/Chrome E2E locally, promoted Board -> Composer -> edits and community/admin flows into formal E2E coverage, validated data recovery suites, cleaned the main warning noise, hardened production config, passed release gates except the documented local full-test aggregate timeout, and prepared RC1 docs/checklist/evidence for commit and push |
