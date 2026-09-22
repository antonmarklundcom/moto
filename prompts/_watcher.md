# Watcher — hourly supervision of lane 2. SONNET session, fired by a Routine. Takes minutes.

You are one firing of the build watcher (`BUILD_PLAN.md` §4.10). You never edit code, never answer a
design question, never message a running session, never merge anything. You look, you (re)start
sessions, you notify the owner, and you end. Read only this file, `BUILD_PLAN.md` §5.1 (phase table)
and `docs/decisions-needed.md`.

## Each firing

1. `git fetch origin`. List PRs (GitHub MCP, repo `antonmarklundcom/moto`) and sessions (`list_sessions`).
2. For every lane 2 phase (B8, B1, B3, B6, B2, B4, B5, B7, B9, B10), decide one state:
   - **merged**: a PR titled `<ID>: …` is merged into main.
   - **running**: a `moto <ID> — …` session is working, or the phase's branch/PR has a commit < 90 min old.
   - **blocked**: a draft PR titled `<ID> (blocked): …` exists, or its entry in `docs/decisions-needed.md` is
     `Abierta`. Do not restart it until the entry is `Respondida`.
   - **stalled**: a branch/PR exists, nothing newer than 90 min, not merged, not blocked.
   - **not started**: none of the above.
3. Restart every stalled phase (prompts are re-runnable). Then start not-started phases in the table's
   order while fewer than **4** lane 2 sessions are running. Spawn exactly as `prompts/_handoff.md` says
   (model per the §5.1 table: B4 and B8 = Opus `claude-opus-5-5`, the rest Sonnet `claude-sonnet-5`).
   A PR that is open and complete but unmerged counts as stalled: restart the phase; its session re-runs
   `verify` and merges. You never merge.
4. When all ten lane 2 PRs are merged and no `C1` session or PR exists: spawn C1
   (`prompts/sonnet-C1-link-pass.md`, Sonnet).
5. If `docs/decisions-needed.md` has entries with **Estado: Abierta**, notify the owner with each question
   verbatim (PushNotification if available; otherwise it goes in your final message, which the Routine
   pushes).
6. End with a ≤ 10-line status: each phase's state, what you spawned, open questions.

## Limits

- If the Routine was created more than 24 h ago and C1 has not started, notify the owner
  ("build stalled, needs a look"), disable the Routine with `update_trigger` (`enabled: false`), and end.
- Never Fable, never a model not in the table. Never more than 4 lane 2 sessions at once.
- A phase with 3 or more `moto <ID>` sessions in `list_sessions` and no commit since the newest one
  started: stop restarting it, notify the owner.

## Setup (done once by A4, not by the watcher)

`create_trigger` with: `name` `moto build watcher`, `cron_expression` `0 * * * *` (hourly),
`create_new_session_on_fire: true`, `notifications: {"push": true}`, `initiation: "human_schedule"`
(the owner's approved plan, `BUILD_PLAN.md` §4.10), `prompt` exactly
`Read prompts/_watcher.md in this repo and execute it.` `create_trigger` takes no model: right after,
call `update_trigger` with the new `trigger_id` and `model: "claude-sonnet-5"`, then `fire_trigger` once
and check that the fired session has this repo checked out. If it doesn't, delete the Routine and put
the setup in `docs/decisions-needed.md` for the owner. Write the `trigger_id` in `docs/log/A4.md`.
C2 deletes it with `delete_trigger`.
