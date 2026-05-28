# PsyPic RC1 Release Checklist

## RC1 Status

- Status: conditionally accepted for RC1 packaging.
- Date: 2026-05-28.
- Evidence package: `docs/rc1-evidence/rc1-acceptance.json`.
- Remaining local gate blocker: full aggregate `pnpm test` exceeds the local timeout; RC-critical suites were split and passed.

## Gate Results

| Gate | Result | Notes |
| --- | --- | --- |
| `git diff --check` | Pass | No whitespace errors. |
| `pnpm lint` | Pass | ESLint now ignores generated `.claude`, `output`, `.next`, `.data`, and Playwright browser directories. |
| `pnpm typecheck` | Pass | Uses `tsc --noEmit --incremental false`; avoids local `tsconfig.tsbuildinfo` write failures. |
| `pnpm test` | Blocked locally | 30 minute aggregate run timed out without stable output. Split RC-critical Vitest suites passed. |
| `pnpm build` | Pass | Next production build completed successfully. |
| `pnpm e2e` | Pass | 8 Playwright tests passed in 10.5 minutes. |

## Business Acceptance

| Workflow | Result | Evidence |
| --- | --- | --- |
| Login / register / Sub2API key binding | Pass | `tests/api/auth.test.ts`, `tests/e2e/workbench-auth-sync.spec.ts` |
| Text-to-image / image-to-image / multi-reference / mask edit | Pass | `tests/api/image-generations.test.ts`, `tests/api/image-edits.test.ts`, `tests/e2e/workbench-generation-events.spec.ts` |
| Board material -> reference export -> Composer -> image edit | Pass | `tests/e2e/board-composer.desktop.spec.ts`, screenshot in `output/playwright/screenshots/board-composer-edits-desktop.png` |
| Generated result enters library | Pass | `tests/e2e/community-admin.desktop.spec.ts`, `tests/api/library.test.ts`, `/api/library` readback |
| Publish asset to community | Pass | `tests/e2e/community-admin.desktop.spec.ts`, `tests/api/community-works.test.ts` |
| Community detail -> same generation | Pass | `tests/e2e/community-admin.desktop.spec.ts`, screenshot in `output/playwright/screenshots/community-detail-same-desktop.png` |
| Admin report / take down / restore / feature | Pass | `tests/e2e/community-admin.desktop.spec.ts`, `tests/api/community-moderation.test.ts`, screenshot in `output/playwright/screenshots/admin-moderation-desktop.png` |

## Recovery Acceptance

| Capability | Result | Evidence |
| --- | --- | --- |
| Server workbench project/session/version node persistence | Pass | `tests/api/workbench-version-nodes.test.ts`, context-aware generation/edit API tests |
| Fallback / IndexedDB mode keeps local work | Pass | `tests/api/workbench-sync.test.ts`, `tests/unit/workbench-cache-store.test.ts`, `tests/unit/workbench-outbox-store.test.ts` |
| Outbox sync after server recovery | Pass | `tests/unit/sync-engine.test.ts` recovery case |
| Board snapshot restore/audit/re-edit path | Pass | `tests/api/image-edits.test.ts`, `tests/unit/board-store.test.ts`, Board E2E |
| Failed / canceled / retry tasks | Pass | `tests/api/image-generations.test.ts`, `tests/api/image-job-queue.test.ts`, `tests/api/batches.test.ts`, `tests/components/task-dock.test.tsx` |

## Accepted Warnings

- Full `pnpm test` aggregate is not accepted as green on this workstation; it is a remaining local gate blocker. Use split suites listed in the evidence JSON until CI/test sharding is fixed.
- Playwright dev server still logs `Fast Refresh had to perform a full reload` while all tests pass.
- Playwright dev server still logs one `/api/workbench/job-runtime-events` `Unexpected end of JSON input` after green assertions; production build is green.

## External Blockers Before Production

- Verify real Sub2API Base URL and API key in staging/production.
- Verify live PostgreSQL `DATABASE_URL` and Redis `REDIS_URL` connectivity.
- Configure R2/S3/MinIO asset storage; production `ASSET_STORAGE_DRIVER=local` is intentionally blocked by `/api/health`.
- Provide distinct high-entropy `SESSION_SECRET` and `KEY_ENCRYPTION_SECRET`.

## Optional Release Actions

- Create PR after push if upstream workflow expects review.
- Create a tag only after external staging credentials and storage checks pass.
