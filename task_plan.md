# Task Plan: PsyPic Release Candidate 1

## Goal
把 PsyPic 推到 Release Candidate 1：可部署、可回归、可演示、可排障。

## Current Phase
Phase 7: Release packaging

## Phases

### Phase 1: RC1 plan and E2E discovery
- [x] Capture the RC1 goal and release-quality criteria.
- [x] Inspect current scripts, Playwright config, and existing E2E tests.
- [x] Reproduce the official `pnpm e2e` blocker.
- [x] Decide whether to fix browser installation path, add `e2e:chrome`, or both.
- **Status:** complete

### Phase 2: E2E formalization
- [x] Make `pnpm e2e` and/or `pnpm e2e:chrome` stable locally.
- [x] Add the Board -> Composer -> edits path to formal E2E coverage.
- [x] Store validation output or artifacts needed for release review.
- **Status:** complete

### Phase 3: Warning cleanup
- [x] Clear React `act(...)` warnings where test behavior is under our control.
- [x] Clear or classify Konva/jsdom `onTap`, `onTransformEnd`, and `NaN defaultValue` warnings.
- [x] Investigate browser hydration mismatch and classify it as extension/test noise or SSR risk.
- [x] Document any accepted warning with owner, reason, and follow-up.
- **Status:** complete for jsdom/unit warning cleanup and official E2E gate; remaining Next dev-server reload noise is documented as accepted dev-only baseline pending production-build verification.

### Phase 4: Production configuration hardening
- [x] Audit production requirements for `DATABASE_URL`, Prisma mode, session secret, and key encryption secret.
- [x] Confirm production image storage expectations and document local-only limits.
- [x] Verify `/api/health` reports db, redis, auth, and storage status clearly enough for deployment.
- [x] Verify `/api/e2e/session` remains 404 outside test/e2e mode.
- **Status:** complete for env/secret/storage/test-endpoint hardening. Live DB/Redis connectivity probes still require a real staging target and remain a Phase 7 release-gate item.

### Phase 5: Core business workflow acceptance
- [x] Validate login and Sub2API key setup.
- [x] Validate text-to-image, image-to-image, multi-reference, and mask edit flows.
- [x] Validate Board material add -> reference export -> Composer -> image-to-image.
- [x] Validate generated assets entering the library.
- [x] Validate publish to community, detail -> remix, and admin moderation flows.
- **Status:** complete. Evidence is recorded in `docs/rc1-evidence/rc1-acceptance.json`; UI artifacts are under `output/playwright/screenshots/`.

### Phase 6: Data recovery and sync hardening
- [x] Verify server workbench version-node persistence.
- [x] Verify fallback / IndexedDB behavior does not lose work.
- [x] Verify outbox sync after server recovery preserves history.
- [x] Verify Board snapshots can be restored, audited, and edited again.
- [x] Verify failed, canceled, and retried tasks close the loop in UI and API.
- **Status:** complete for local/API/E2E acceptance. Live DB/Redis/object-storage recovery remains a staging blocker.

### Phase 7: Release packaging
- [x] Run all release gate commands.
- [x] Save browser screenshots and acceptance JSON artifacts.
- [x] Update `docs/17-测试与验收用例.md`.
- [x] Create or update `RELEASE_CHECKLIST.md`.
- [ ] Commit and push.
- [ ] Optionally create a PR or tag if requested.
- **Status:** in progress. `git diff --check`, lint, typecheck, build, and E2E passed; aggregate `pnpm test` is recorded as a local timeout blocker with split-suite pass evidence.

## Key Questions
1. What is the smallest reliable way to unblock official E2E on this Windows workstation?
2. Should Chromium remain the default Playwright project, with Chrome as an opt-in local fallback, or should a repo script expose both explicitly?
3. Which warnings indicate real product risk versus jsdom/browser-extension noise?
4. Which production dependencies are currently real, stubbed, or missing from `/api/health`?
5. Which RC acceptance flows can be automated now, and which require documented manual verification?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Track RC1 work in `task_plan.md`, `findings.md`, and `progress.md` | The goal spans multiple phases and needs persistent state beyond the chat context. |
| Start with E2E formalization | `pnpm e2e` is the largest known release blocker and gates the rest of RC confidence. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `pnpm e2e` failed with `error: unknown command 'test'` | 1 | Diagnose Playwright CLI/bin resolution before repeating E2E run |
| Local Playwright CLI failed because webServer could not find `next` | 1 | Repair or avoid incomplete local `.bin` links before continuing |
| `pnpm install` failed with EPERM on `node_modules/@esbuild/win32-x64` | 1 | Check for active process/lock before retrying installation |
| `pnpm e2e:chrome` timed out with Turbopack watcher/path errors | 1 | Updated Playwright webServer to use `next dev --webpack` |
| `pnpm e2e:chrome` timed out after webpack fix | 1 | Narrow to single desktop spec and inspect artifacts |
| Single desktop E2E timed out with Watchpack watcher flood | 1 | Added `WATCHPACK_POLLING=true` to Playwright webServer env |
| Single desktop E2E reached success UI but hit 90s test timeout | 1 | Increased Playwright test timeout to 180s |
| Single desktop generation E2E hit 15s expect timeout while waiting for task completion | 1 | Increased Playwright expect timeout to 60s |
| Full Chrome E2E exceeded 120s webServer readiness timeout | 1 | Increased Playwright webServer timeout to 300s |
| Board E2E drag target landed under the Board inspector | 1 | Moved the drop target into the visible stage and capped drag timeout at 30s |
| Playwright `request.postData()` returned an empty string for multipart edit submissions | 1 | Added a browser-side fetch/FormData recorder to assert the submitted Board export image |
| Workbench project API returned `工作台数据库不可用` in the no-DB official E2E environment | 1 | Kept Phase 2 coverage focused on the real Board -> Composer -> edits browser path; moved DB-backed Board snapshot persistence to Phase 6 |
| Board E2E result assertion matched two `alt="生成结果"` images after the edit | 1 | Scoped result assertions to `data-testid="active-gallery"` |
| Merging Next's existing webpack `watchOptions.ignored` into an array produced invalid webpack config | 1 | Replaced the merge with explicit string glob ignores |
| Explicit dev watcher ignores omitted default-scale directories and caused `/api/e2e/session` to hang during cold E2E | 1 | Added `**/node_modules/**` and `**/.git/**` back to the dev watcher ignore list |
| Health check object named `secrets` was redacted by the API response sanitizer | 1 | Renamed the health section to `credentials` and used redaction-safe field names |
| Combined Vitest command for production hardening timed out after 5 minutes without useful output | 1 | Split into single/smaller test files; health, e2e-session, and key-binding tests all passed |

## Notes
- AgentBridge collaboration proposal: Codex handles local execution, E2E, warning cleanup, and code changes; Claude reviews RC acceptance, deployment, and recovery checklist completeness.
- Prefer existing project conventions over generic process where they conflict.
- Phase 2 artifact: `output/playwright/screenshots/board-composer-edits-desktop.png`.
- Phase 3 accepted warning baseline:
  - Next dev `Fast Refresh had to perform a full reload` still appears once in full E2E; no hydration mismatch text was observed in the official E2E output.
  - Next dev sometimes logs `SyntaxError: Unexpected end of JSON input` for `/api/workbench/job-runtime-events` after the suite is already green. Current evidence points to a dev-server reload/race, not a failed browser assertion; keep tracked for production-build and Phase 7 gate review.
- Phase 4 production hardening:
  - `/api/health` now reports `credentials` without leaking or triggering response redaction, fails placeholder production credentials, and fails local asset storage under `NODE_ENV=production`.
  - `KEY_ENCRYPTION_SECRET` no longer falls back to the development key in production.
  - `/api/e2e/session` has explicit production 404 test coverage.
