# 画廊工作台与对话式版本流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a gallery-first creator workspace where each generation becomes a recoverable version node and generating from an older node creates a non-destructive branch.

This plan is now the implementation predecessor of the broader image workbench blueprint in `docs/19-图片工作台改造蓝图.md`: its `CreatorVersionNode` model should be read as the first local-first version node layer.

**Architecture:** Keep the first implementation client-side inside the existing CreatorWorkspace flow, but extract version graph logic into a focused library. The UI changes preserve existing API contracts and reuse current generation, history, library, batch, and community actions.

**Tech Stack:** Next.js App Router, React client components, TypeScript, IndexedDB local history, Vitest + Testing Library, CSS modules via `app/globals.css`.

---

## File Structure

- Create: `lib/creator/version-graph.ts`
  - Pure helpers for creating root/child nodes, importing local history, finding active branch children, and deriving branch labels.
- Modify: `lib/history/local-history.ts`
  - Add optional version graph fields without breaking old IndexedDB records.
- Modify: `components/creator/CreatorWorkspace.tsx`
  - Add version node state, active node state, fork parent state, gallery-first layout markup, version stream actions, inspector actions.
- Modify: `app/globals.css`
  - Replace creator grid with gallery workspace shell, version stream, inspector, bottom composer, branch preview styles.
- Modify: `tests/components/creator-shell.test.tsx`
  - Add behavior tests for node creation, parameter restore, version switching, and non-destructive branching.
- Optionally modify: `docs/17-测试与验收用例.md`
  - Add gallery/version-flow acceptance rows after implementation.

## Task 1: Version Graph Pure Model

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/version-graph.test.ts` covering:

```ts
it("creates a root node from a generation result");
it("creates a child node on the same branch when parent has no children");
it("creates a new branch when generating from a node that already has children");
it("imports old local history as root nodes without losing images");
```

Run:

```bash
pnpm vitest --run tests/unit/version-graph.test.ts
```

Expected: FAIL because `lib/creator/version-graph.ts` does not exist.

- [ ] **Step 2: Implement minimal model helpers**

Create `lib/creator/version-graph.ts` with:

- `CreatorVersionNode`
- `CreatorVersionSource`
- `createVersionNode`
- `createNodeFromHistory`
- `getChildCount`
- `getNextBranchLabel`
- `summarizeNodeParams`

- [ ] **Step 3: Run unit tests**

Run:

```bash
pnpm vitest --run tests/unit/version-graph.test.ts
```

Expected: PASS.

## Task 2: Local History Compatibility

- [ ] **Step 1: Write failing history test**

Extend existing local history tests so records can carry:

- `images`
- `parentTaskId`
- `branchId`
- `branchLabel`
- `versionNodeId`

Run:

```bash
pnpm vitest --run tests/api/history.test.ts
```

Expected: FAIL until type/schema support is added.

- [ ] **Step 2: Extend `LocalHistoryItem` optional fields**

Modify `lib/history/local-history.ts` only with optional fields. Do not migrate IndexedDB version for this phase; old records remain valid.

- [ ] **Step 3: Run history tests**

Run:

```bash
pnpm vitest --run tests/api/history.test.ts
```

Expected: PASS.

## Task 3: Version Nodes In CreatorWorkspace

- [ ] **Step 1: Write failing component tests**

Extend `tests/components/creator-shell.test.tsx`:

- After a successful generation, the version stream shows one node with prompt text and params summary.
- The current gallery displays all returned images as the main work area.
- Clicking `恢复参数` on a node restores prompt and size controls.
- Clicking `回到版本` swaps the main gallery to that node.

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: FAIL because version stream actions do not exist.

- [ ] **Step 2: Wire version node state**

Modify `CreatorWorkspace.tsx`:

- `const [versionNodes, setVersionNodes] = useState<CreatorVersionNode[]>([])`
- `const [activeNodeId, setActiveNodeId] = useState<string | null>(null)`
- `const [forkParentId, setForkParentId] = useState<string | null>(null)`
- On `commitGenerationResult`, create a version node and make it active.
- Use `activeNode?.images ?? result?.images` for gallery rendering.

- [ ] **Step 3: Render version stream**

Add a left-side or upper-side version stream section with:

- prompt summary
- params summary
- thumbnail strip
- `回到版本`
- `恢复参数`
- `从此分叉`

- [ ] **Step 4: Run component tests**

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: PASS.

## Task 4: Non-Destructive Branch Generation

- [ ] **Step 1: Write failing branch component test**

Test flow:

1. Generate node A.
2. Generate node B from A.
3. Click node A `从此分叉`.
4. Generate node C.
5. Assert B still exists.
6. Assert C appears under a different branch label.

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: FAIL until fork parent handling is wired.

- [ ] **Step 2: Implement fork parent semantics**

In `commitGenerationResult`:

- Parent is `forkParentId ?? activeNodeId`.
- If parent already has children, helper creates a new branch label.
- After commit, set `forkParentId(null)` and `activeNodeId(newNode.id)`.

- [ ] **Step 3: Run component tests**

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: PASS.

## Task 5: Gallery-First Layout

- [ ] **Step 1: Write layout assertions**

Add tests for stable labels/test ids:

- `creator-gallery-shell`
- `version-stream`
- `active-gallery`
- `node-inspector`
- `prompt-composer`

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: FAIL until markup changes.

- [ ] **Step 2: Update markup**

Move UI into:

```text
creator-gallery-shell
  studio-rail
  active-gallery
  node-inspector
  prompt-composer
```

Keep current controls and actions functional.

- [ ] **Step 3: Update CSS**

Modify `app/globals.css`:

- wide desktop: rail 280px, gallery 1fr, inspector 320px
- bottom composer sticky inside main shell
- mobile: gallery first, composer sticky bottom, rail/inspector collapsible or stacked

- [ ] **Step 4: Run component tests**

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: PASS.

## Task 6: Branch Graph Preview

- [ ] **Step 1: Write failing test**

Assert `分支图` section renders nodes with `data-depth` and branch labels after branching.

- [ ] **Step 2: Implement CSS-based branch preview**

No canvas yet. Render a compact tree/list:

- depth indent
- branch badge
- parent marker
- active node highlight

- [ ] **Step 3: Run component tests**

Run:

```bash
pnpm vitest --run tests/components/creator-shell.test.tsx
```

Expected: PASS.

## Task 7: Regression And Visual Check

- [ ] **Step 1: Run full automated checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all pass.

- [ ] **Step 2: Browser visual check**

Open:

```bash
http://127.0.0.1:3000/
```

Check desktop and mobile:

- gallery is the dominant visual area
- multi-result cards do not feel cramped
- version stream is readable
- bottom composer does not cover content
- inspector text does not overflow

- [ ] **Step 3: Update acceptance docs**

Add checklist rows to `docs/17-测试与验收用例.md`.
