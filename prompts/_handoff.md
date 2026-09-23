# Handoff — what "done" means for a phase, and how the next one starts

Every phase prompt ends with "Follow `prompts/_handoff.md`". This is that. `BUILD_PLAN.md` §4.10.

## The four gates (all of them, in this order)

1. **PR merged green.** Title `<ID>: <name>` (e.g. `A1: security core`), body ≤ 25 lines, written once:
   what was built, exit criteria checked off, what was verified and what was not, `verify green on <sha>`.
   Green = `npm run verify` passes on the PR head after merging latest `main` into it. There is no CI
   (§4.15); you run it. Merge with a merge commit or squash via the GitHub MCP tools; delete nothing else.
2. **Exit checklist passed.** Every exit line of your prompt is met or, if it depends on the owner
   (credentials, hPanel), written as "needs owner: H-n" in the log. Never tick what you didn't run.
3. **Pre-handoff audit, once.** `git checkout main && git pull`, run `npm run verify` once on main, then
   re-read the merged diff once, adversarially (authz, secrets, invented data, Spanish copy, indexation).
   Fix findings in ONE follow-up commit on a new branch + PR, merged the same way. No second round.
4. **Phase log committed** (inside the PR, or in the follow-up): `docs/log/<ID>.md`, ≤ 30 lines:
   Built / Decisions / Known issues / Link-pass wishes (lane 2 only: cross-links or nav entries you want C1 to
   add, one line each with the target file) / `Verification: verify green on <sha>`. Add one line to
   `BUILD_PLAN.md` §13: `| <ID> | <PR link> | docs/log/<ID>.md |`.

## Spawning the next phase

Only when your prompt says so. Call `create_session` (claude-code-remote MCP; load it with ToolSearch):

- `prompt`: exactly `Read prompts/<next-file>.md in this repo and execute it.`
- `model`: **always `claude-opus-5-5`** for every phase (`BUILD_PLAN.md` §5.1, owner 2026-09-23), whatever the
  filename prefix says (`sonnet-*.md` names are historical). `claude-sonnet-5` is only for the watcher Routine.
  **Never Fable** (`BUILD_PLAN.md` §4.8). If you think Fable is needed, write it to `docs/decisions-needed.md`.
- `title`: `moto <ID> — <name>` (the watcher finds sessions by this prefix).
- `source_url`: `https://github.com/antonmarklundcom/moto`, `source_revision`: `main`.
- `environment_id`: omit (inherit). `permission_mode`: omit (inherit). **Never `plan`**: no one is watching.
- One call per phase. Before calling, `list_sessions` and skip any phase whose `moto <ID>` session is
  already running (a re-run of your own prompt must not double-spawn).

Fallback when `create_session` is unavailable (local CLI): if the next phase uses the same model, continue
it in this window; otherwise stop and tell the owner the exact line to paste and which model to pick.

## Lane rules at the boundary

- Lane 1 (A1→A2→A3→A4) spawns the next lane 1 phase. A0 also spawns R0 (lane 0).
- **A4** creates the watcher Routine (`prompts/_watcher.md` §Setup), then spawns the first 4 lane 2 phases
  in this order: B8, B1, B3, B6. The watcher starts the rest (B2, B4, B5, B7, B9, B10) as slots free.
- Lane 2 phases spawn nothing. The watcher spawns C1 when every lane 2 PR is merged.
- C1 spawns C2. C2 deletes the watcher Routine and writes `docs/closing-report.md`.

## If you are blocked

Hard stop only per `BUILD_PLAN.md` §4.4: append the entry to `docs/decisions-needed.md` (template inside),
commit, push your branch, open the PR as draft titled `<ID> (blocked): <name>`, end the session. Don't wait
for an answer in the session; the watcher notifies the owner, and a re-run of your prompt continues.
