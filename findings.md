# Findings & Decisions: PsyPic RC1

## Requirements
- Release Candidate 1 standard: deployable, regression-testable, demoable, and diagnosable.
- First priority is removing the official E2E blocker around missing Playwright Chromium revision.
- Stabilize `pnpm e2e` or add/document `pnpm e2e:chrome` using `PSYPIC_E2E_BROWSER_CHANNEL=chrome`.
- Promote Board -> Composer -> edits into formal E2E coverage.
- Reduce warning noise from tests and browser runs to a documented, explainable baseline.
- Harden production configuration around database, secrets, storage, health checks, and test-only endpoints.
- Deeply validate the business workflow for commercial image creation, library, community publishing, remixing, and moderation.
- Validate persistence, fallback, outbox sync, Board snapshots, and task failure/cancel/retry behavior.
- Produce release artifacts: passing gates, screenshots, acceptance JSON, updated docs, release checklist, commit, push, and optional PR/tag.

## Research Findings
- Repository root already has `package.json`, `playwright.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `docs/17-测试与验收用例.md`, and deployment docs.
- No existing `task_plan.md`, `findings.md`, `progress.md`, or `RELEASE_CHECKLIST.md` was present before this session.
- Git branch at session start: `main...origin/main`, with no short-status changes reported before adding planning files.
- `package.json` currently exposes `pnpm e2e` as `playwright test` and `pnpm e2e:install` as `playwright install chromium`; there is no `e2e:chrome` script yet.
- `playwright.config.ts` defines desktop and mobile projects using Chromium-flavored device presets, with a Next dev server on `PSYPIC_E2E_PORT` defaulting to 3200.
- Existing formal E2E specs are `tests/e2e/workbench-auth-sync.spec.ts` and `tests/e2e/workbench-generation-events.spec.ts`; no dedicated Board -> Composer -> edits spec was found in `tests/e2e`.
- `node_modules/.bin` currently only contains `tsc`, `tsserver`, and `vitest`, so package scripts and `pnpm exec` can fall through to unrelated global executables such as Python's `playwright.exe`.
- Directly invoking `node ./node_modules/@playwright/test/cli.js test` bypasses the Python Playwright collision, but the Playwright `webServer` command then fails because `next` is also missing from `.bin`.
- `pnpm e2e:chrome` can bypass the missing Playwright browser revision and reach app startup, but Next 16 dev defaulted to Turbopack when launched as `next dev`; this hit Windows watcher/resource/path failures.
- The repo's existing `dev` script already uses `next dev --webpack`; E2E webServer should match that mode for local stability.
- After switching E2E webServer to webpack, `pnpm e2e:chrome` no longer reports CLI/browser/Turbopack startup errors, but the suite still exceeds the outer timeout. Playwright artifacts show 90s test timeouts around initial home page navigation and browser context closure.
- A single desktop auth-sync spec still times out while Next's webpack dev server floods `Watchpack Error (watcher)` messages, indicating native file watching is unstable in this workspace.
- With `WATCHPACK_POLLING=true`, the single desktop auth-sync spec reaches the settings UI and the success text is visible in the Playwright snapshot, but cold compilation pushes the test beyond the previous 90s timeout.
- After increasing per-test timeout to 180s, `workbench-auth-sync.spec.ts` passes on the desktop Chrome project: 2 passed in 3.5m.
- `workbench-generation-events.spec.ts` reaches generation submission on desktop Chrome, but the 15s expect timeout expires while the generation API route is cold-compiling/submitting.
- After increasing expect timeout to 60s, `workbench-generation-events.spec.ts` passes on the desktop Chrome project: 1 passed in 3.6m.
- Full `pnpm e2e:chrome` can still fail before tests if the Next dev server health route takes longer than 120s to compile on a cold run.
- After increasing webServer timeout to 300s, full `pnpm e2e:chrome` passes across desktop and mobile projects: 6 passed in 6.7m.
- `pnpm e2e:install` now installs Playwright-managed browser assets into the fixed project-local `.playwright-browsers` path via `PLAYWRIGHT_BROWSERS_PATH`.
- Official `pnpm e2e` now passes with Playwright-managed Chromium after `pnpm e2e:install`: 6 passed in 7.3m.
- Added formal desktop E2E coverage for Board -> Composer -> edits in `tests/e2e/board-composer.desktop.spec.ts`.
- The Board E2E flow generates a source asset, syncs it into the library, drags it into Board, exports it as a Composer reference, submits `/api/images/edits`, and verifies the submitted `image` FormData file is a non-empty `board-export-*.png`.
- Single Board E2E passes through system Chrome: 1 passed in 3.7m.
- Official `pnpm e2e` now includes the Board flow and passes with Playwright-managed Chromium: 7 passed in 7.0m.
- Current official E2E runs without a configured workbench database; `/api/workbench/projects` returns `工作台数据库不可用`. Server-side Board snapshot/version-node persistence therefore belongs in Phase 6 or a future DB-mode E2E lane rather than the no-DB official browser gate.
- Full E2E output still contains webpack critical dependency warnings from dynamic Prisma-related imports and one `/api/workbench/job-runtime-events` `Unexpected end of JSON input` server log despite a green suite; these are warning-cleanup candidates.
- `react-konva` is mocked in `vitest.setup.ts`; forwarding Konva-only props such as `onTap` and `onTransformEnd` to DOM nodes caused jsdom/React warning noise. Filtering DOM-valid event props while storing Konva-only handlers on the mocked node removes that class of warning and preserves Board unit test reachability.
- Board drag/drop tests could produce `NaN` coordinate/defaultValue warnings when jsdom events lacked client coordinates. `BoardStage` now guards pointer coordinates and falls back to the visible stage center.
- Creator shell warning noise was partly caused by no-op async state writes when IndexedDB-backed lists were unavailable or empty. `CreatorWorkspace`, `useProjects`, and `useBranchMeta` now avoid those updates in no-store/no-data branches.
- QuickPick's test path produced focus/act warnings through a modal dropdown; changing the size dropdown to `modal={false}` and exercising template cards in the test keeps the interaction faithful while reducing modal focus trap noise.
- TaskDock now retries a terminal task's runtime-event fetch after transient errors, which covers the dev-server reload race seen in E2E without hiding persistent failures.
- Dynamic Prisma-related imports using package-name variables caused webpack `Critical dependency: the request of a dependency is an expression` warnings in E2E. Replacing them with literal dynamic imports removed the critical dependency warning from subsequent full E2E output.
- Dev watcher ignores must keep dependency-scale defaults. A first `next.config.ts` attempt failed webpack validation when it merged Next's existing ignore shape into an array; a second attempt passed validation but omitted `node_modules`/`.git` and made `/api/e2e/session` cold requests hang. The retained version uses explicit string globs for `node_modules`, `.git`, `output`, `.data`, and `.playwright-browsers`.
- Full official E2E after warning cleanup passes: 7 passed in 7.1m. Remaining output is limited to a Next dev `Fast Refresh had to perform a full reload` warning and a dev-server `SyntaxError: Unexpected end of JSON input` log for `/api/workbench/job-runtime-events`; no browser assertion failed and no hydration mismatch text appeared.
- Production config audit found that `.env.example` lacked several explicit production store-mode variables even though services support database modes. It now lists `PSYPIC_AUTH_STORE`, `PSYPIC_IMAGE_TASK_STORE`, `PSYPIC_JOB_RUNTIME_EVENT_STORE`, `PSYPIC_COMMUNITY_STORE`, `PSYPIC_BOARD_DOCUMENTS_STORE`, and `PSYPIC_SEARCH_INDEX_ENABLED`.
- `KEY_ENCRYPTION_SECRET` previously fell back to a development-only value everywhere. It now throws before encrypting key bindings when `NODE_ENV=production` and the env var is missing or still a placeholder.
- `/api/health` now reports a redaction-safe `credentials` section. The initial field name `secrets` was correctly redacted by `jsonOk` because response keys containing `secret` are treated as sensitive.
- `/api/health` now fails production readiness for placeholder credentials and for `ASSET_STORAGE_DRIVER=local` when `NODE_ENV=production`; local storage remains allowed for development/test.
- `/api/e2e/session` already returned 404 in production; test coverage now explicitly proves it remains 404 even when `PSYPIC_E2E_TOKEN` matches.
- `/api/health` still reports DB/Redis as configuration status rather than live network pings. A real staging DB/Redis target is required before turning that into a release-gate smoke result.
- Core API acceptance is green for auth, image generations, image edits, library, community works, and community moderation in focused Vitest runs.
- `tests/e2e/community-admin.desktop.spec.ts` now covers the RC1 user chain from generated library asset to community publish, community detail, same-generation draft handoff, reporting, admin review, feature, takedown, and restore.
- The community/admin E2E writes machine-readable evidence to `output/playwright/acceptance/rc1-community-admin.desktop.json`; committed summary evidence is stored in `docs/rc1-evidence/rc1-acceptance.json`.
- Workbench recovery coverage is green across server sync APIs, version nodes, fallback cache, local outbox, sync engine, and Board store snapshot behavior.
- Sync-engine now has an explicit regression proving that local outbox entries survive server downtime and clear only after recovery sync succeeds.
- Task closure evidence is green through TaskDock UI behavior, batch APIs, and image job queue APIs.
- ESLint needed explicit ignores for generated/cache/output directories; `.gitignore` alone does not prevent ESLint from traversing paths when invoked broadly.
- TypeScript typecheck completed locally after disabling incremental build-info writes in the `typecheck` script.
- `process.env.NODE_ENV` is readonly in the current type environment; tests that need environment switching should use scoped helper mutation/restoration rather than direct assignment.
- Release gates now pass for `git diff --check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm e2e`.
- Full `pnpm test` remains a local aggregate blocker because it timed out without actionable failures; the RC1 evidence uses focused high-risk suite passes and records the aggregate timeout as an accepted warning/risk.
- Production/staging external blockers remain credential and infrastructure validation: real Sub2API key, production database, Redis, object storage, and live DB/Redis connectivity smoke checks.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use file-based planning for RC1 | The work spans E2E, warnings, production config, workflows, recovery, and release packaging. |
| Keep Phase 1 centered on E2E discovery | Browser setup and official E2E stability are known blockers and should be reproducible before broader cleanup. |
| Keep no-DB official E2E separate from server persistence evidence | The local browser gate intentionally supports fallback/no-DB mode; server persistence belongs in API/unit recovery suites and later staging smoke tests. |
| Commit a summarized acceptance JSON rather than raw screenshots | Screenshot and Playwright artifacts live under ignored `output/`; the committed JSON gives stable reviewable evidence while local artifacts remain available on the workstation. |
| Treat full `pnpm test` as a documented RC1 local blocker | It times out without actionable failures, while targeted high-risk suites and release gates pass; this preserves release signal without claiming false green status. |
| Disable TypeScript incremental output for the release gate | `tsc --noEmit --incremental false` avoids local build-info write stalls/failures and keeps typecheck deterministic for this workspace. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `pnpm e2e` currently fails with `error: unknown command 'test'`, before reaching browser launch. This is different from the expected Chromium revision failure. | Diagnose Playwright CLI/bin resolution before attempting browser installation or config changes. |
| Local dependency bin links appear incomplete. | Run dependency install/relink and then re-test before making repo script changes. |
| `pnpm install` could not complete because Windows denied access to `node_modules/@esbuild/win32-x64`. | Check active processes/locks; avoid repeating the same install command until lock cause is addressed. |
| E2E app startup failed under Turbopack. | Use `next dev --webpack` for Playwright webServer, consistent with `pnpm dev`. |
| E2E suite still times out after webpack startup. | Reduce to a single project/spec to identify whether the blocker is first-page compile time, app runtime error, or test expectation drift. |
| Native Watchpack watching is unstable on this Windows workspace. | Set `WATCHPACK_POLLING=true` for E2E webServer startup. |
| 90s per-test timeout is too tight for cold Next webpack compilation with polling on this Windows workspace. | Increase Playwright per-test timeout to 180s. |
| 15s expect timeout is too tight for cold generation route compilation in E2E. | Increase Playwright expect timeout to 60s. |
| 120s webServer startup timeout is too tight for a cold full-suite run on this Windows workspace. | Increase Playwright webServer timeout to 300s. |
| Chrome fallback is now a viable local E2E gate. | Keep `pnpm e2e:chrome` documented and use it when Playwright-managed Chromium is not installed. |
| Playwright-managed Chromium can be installed in a deterministic repo-local cache. | Keep `.playwright-browsers/` ignored and use `pnpm e2e:install` before `pnpm e2e` on fresh machines. |
| The official E2E command is no longer blocked on this workstation. | Keep it as the primary browser regression gate for RC1. |
| Board -> Composer -> edits is now a formal E2E gate. | Continue to warning cleanup and later add DB-mode coverage for Board snapshot persistence. |
| No-DB E2E cannot prove server workbench Board snapshot persistence. | Track that under Phase 6 data recovery/sync hardening. |
| React/Konva/jsdom warning noise is now handled in test mocks and input guards rather than console filtering. | Keep tests exercising real component behavior while avoiding invalid DOM props and non-finite coordinates. |
| Prisma dynamic import warnings are fixed at the source. | Use literal dynamic imports so webpack can statically understand optional Prisma packages. |
| Next dev Fast Refresh reload and one job-runtime-events JSON parse log remain accepted for this phase. | Treat as dev-server reload noise unless production build or non-dev server verification reproduces it; keep visible in Phase 7 gate review. |
| Health credential status fields must avoid names that the API redaction layer treats as sensitive. | Use `credentials.session_signing`, `credentials.key_encryption`, and `credentials.distinct_keys`, while docs still map them to `SESSION_SECRET` and `KEY_ENCRYPTION_SECRET`. |
| Production object storage must not use local disk. | Health fails local storage only under `NODE_ENV=production`; development and tests can keep local storage. |
| Live DB/Redis health remains a deployment-environment concern. | Current code distinguishes configured/skipped/fail modes, but true connectivity must be verified against staging/prod infrastructure in Phase 7. |
| Community/admin moderation acceptance needed an end-to-end browser record. | Added a desktop Playwright spec with screenshots and JSON evidence. |
| Outbox recovery needed a direct regression around server downtime. | Added a sync-engine test that preserves local operations while the server is unavailable and clears them after recovery. |
| ESLint traversed ignored generated/output directories. | Added explicit `eslint.config.mjs` ignore entries for generated, cache, build, browser, dependency, and output paths. |
| Typecheck previously timed out or failed locally due to incremental/build-info behavior. | Changed the script to disable incremental writes and re-ran the gate successfully. |
| Direct assignment to `process.env.NODE_ENV` no longer typechecks. | Replaced direct assignments in tests with scoped env helper functions. |
| Full Vitest aggregate does not currently complete on this workstation. | Verified the high-risk API/unit/component groups individually and recorded the aggregate as an RC1 local blocker. |

## Phase 4 Issues Encountered
| Issue | Resolution |
|-------|------------|
| Health checks named `secrets` were redacted to `[REDACTED]` by the API response sanitizer | Renamed the section and fields to redaction-safe status labels |
| Production hardening Vitest aggregate timed out after 5 minutes | Split into individual/smaller files and recorded pass/fail separately |

## Resources
- `package.json`
- `playwright.config.ts`
- `docs/17-测试与验收用例.md`
- `docs/部署与回滚.md`
- `.env.example`
- `RELEASE_CHECKLIST.md`
- `docs/rc1-evidence/rc1-acceptance.json`
- `tests/e2e/community-admin.desktop.spec.ts`

## Visual/Browser Findings
- Board E2E screenshot artifact saved at `output/playwright/screenshots/board-composer-edits-desktop.png`.
- Community detail screenshot artifact saved at `output/playwright/screenshots/community-detail-same-desktop.png`.
- Admin moderation screenshot artifact saved at `output/playwright/screenshots/admin-moderation-desktop.png`.
