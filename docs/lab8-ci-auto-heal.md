# Lab 8 — Auto-Healing CI/CD Pipeline

## How the pipeline works

`.github/workflows/ci.yml` runs on every push and pull request to `main`.

```
push / PR to main
      │
      ▼
┌─────────────── job: test ───────────────┐
│ npm ci → npm run lint → npm test        │
│ (Jest output saved as test-results.log) │
└───────────────┬─────────────────────────┘
       passed ──┘└── Jest step failed (PR only)
                      │
                      ▼
┌────────────────── job: auto-fix (if: failure()) ───────────────────┐
│ 1. download test-results.log                                       │
│ 2. scripts/auto-heal.ts: log + branch diff + source → AI model     │
│ 3. apply patch (guardrail: non-test src/*.ts only)                 │
│ 4. re-run full Jest suite; retry once with the new failures        │
│ 5. all green → push fix/auto-heal-<run id>, open PR into the       │
│    failing branch; otherwise restore the code and fail the job     │
└────────────────────────────────────────────────────────────────────┘
```

| Safeguard | Why |
|---|---|
| Only non-test `.ts` files under `src/` can change (enforced in code, not just the prompt) | The agent cannot make CI green by editing test assertions |
| The patch must pass the full Jest suite before a PR is opened | No PR for a "fix" that does not work |
| `auto-fix` runs only when the Jest step failed, not lint | Lint errors are not test failures |
| Skips `fix/auto-heal-*` branches and branches that already have an open auto-heal PR | No fix-the-fix loops or duplicate PRs |
| Only PRs from this repository; branch names passed via env vars | Forks cannot use the write token; no shell injection through branch names |
| The fix goes to a separate PR into the failing branch, never straight to `main` | A human reviews and merges |

AI provider, configured with repository secrets and variables (empty values count as unset):

| Option | Secret | Variables |
|---|---|---|
| Anthropic (checked first) | `ANTHROPIC_API_KEY` | optional `AI_MODEL` (default `claude-sonnet-5-5`) |
| Any OpenAI-compatible Chat Completions API (OpenAI, Groq, Google Gemini, OpenRouter, ...) | `AI_API_KEY` | `AI_MODEL` (required), `AI_BASE_URL` (full chat endpoint; defaults to OpenAI) |

The first version used GitHub Models through the workflow's `GITHUB_TOKEN`. GitHub retired GitHub
Models on 2026-07-30; its endpoint now answers a bare `HTTP 200 "OK"`. The first real CI runs failed
that way, which is why the provider is now configurable and the script reports non-JSON replies,
network errors, and missing configuration explicitly.

## One-time repository setup

1. GitHub → repository **Settings → Secrets and variables → Actions**: add the AI provider secret
   (and variables, if using an OpenAI-compatible provider) from the table above.
2. GitHub → repository **Settings → Actions → General → Workflow permissions**:
- Select **Read and write permissions**.
- Tick **Allow GitHub Actions to create and approve pull requests**. Without this, `gh pr create`
  fails with "GitHub Actions is not permitted to create or approve pull requests".

## Part 3 — Break-and-fix runbook

```bash
git checkout main && git pull
git checkout -b test/breaking-reservation-change
```

In `src/services/reservation.service.ts`, in the overlap query inside `createReservation`, make the
bounds inclusive:

```diff
-      startTime: { $lt: input.endTime },
-      endTime: { $gt: input.startTime },
+      startTime: { $lte: input.endTime },
+      endTime: { $gte: input.startTime },
```

Effect: a booking that starts exactly when another ends (a valid back-to-back booking) now gets
409 Conflict. Locally, `npm test` shows 5 failing tests (both back-to-back tests, the boundary
fuzz test, a concurrency test, and an HTTP test).

```bash
git commit -am "test: break overlap boundaries to validate auto-heal"
git push -u origin test/breaking-reservation-change
```

Open a PR from `test/breaking-reservation-change` into `main`. Then, in the **Actions** tab:
1. **Lint and test** fails at **Run Jest** (expected).
2. **Auto-heal failing tests** runs and opens a PR `fix/auto-heal-<run id>` →
   `test/breaking-reservation-change`.

Push to the test branch only once: every push re-runs CI. The duplicate guard prevents a second
auto-heal PR while the first is open.

## Human-in-the-loop review

Review the auto-generated PR before accepting it:
1. **Files changed:** only `src/services/reservation.service.ts`; no `__tests__` file.
2. **Diff:** `$lte/$gte` reverted to `$lt/$gt`, which matches the rule
   `existing.start < new.end AND existing.end > new.start`.
3. **Checks:** the PR body reports the full suite passing; optionally run it locally:
   `git fetch && git checkout fix/auto-heal-<id> && npm test`.
4. **Write the audit** in the PR description's "Human-in-the-loop review" section: tick the boxes,
   then add what you checked and your decision.

Example audit (edit to match what you actually saw):

> **Reviewer notes / decision:** The agent traced the 5 failures (back-to-back bookings returning
> 409) to the inclusive `$lte`/`$gte` bounds introduced on this branch and restored strict
> `$lt`/`$gt`. Only `reservation.service.ts` changed; no tests or assertions were touched. The
> patched branch passes all 108 tests. Accepted.
