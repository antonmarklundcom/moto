# Fable review at the lane boundary — paste into a Fable session YOU open (optional, `BUILD_PLAN.md` §8)

When: after A4 merges, before or while lane 2 runs. One read, decisions into files, end. Budget: one session.
Worth it: medium-high. Everything in lane 2 builds on the four modules below.

---

Read-only review of the merged foundation of `antonmarklundcom/moto` on latest `main`. Read `CLAUDE.md`,
`BUILD_PLAN.md` §1, §4, §5, `docs/log/A0.md`–`A4.md`, then only these modules and their tests:

1. Route contract + indexability: `src/lib/seo/**`, `src/lib/env.ts` (ADR-26).
2. State machine: `src/lib/listings/state.ts` against `DATABASE_SCHEMA.md` §3.
3. Lead handler: `src/lib/leads/**`, `src/lib/crm/**` against `INTEGRATIONS.md` §2 and ADR-25.
4. Auth + row scope: `src/lib/auth/**` against `ADMIN_SPEC.md` §1–§2.

For each module answer: does it do what the spec says; what will a lane 2 phase most likely misuse; what is
expensive to change once ten phases depend on it.

Rules for this session: read committed state **once**. Don't poll PRs or sessions, don't message running
sessions, don't spawn anything, don't wait for a build. Write every decision into files and end:
- a correction a lane 2 phase must follow → edit that phase's `prompts/<file>.md` on `main` (phases re-read
  their prompt before merging, `BUILD_PLAN.md` §4.14);
- a bug in a foundation module → one entry in `docs/decisions-needed.md` with the fix, for the owner to route
  to a fix session;
- a summary of ≤ 15 lines in `docs/review/lane-boundary-fable.md`.
Commit directly to a branch `review/lane-boundary`, open a PR, and end. The owner merges it.
