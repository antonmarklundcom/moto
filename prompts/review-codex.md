# Codex security review of one phase — paste into YOUR local Claude session (not a cloud build session)

When: after A1, A3, A4, B4, B8 merge (each phase log says "Codex review due"), and after C2 over the full surface.
Replace `<ID>` and `<PR>` below, then paste everything under the line.

---

Load the `manager-worker-codex` skill. In a fresh local clone of `antonmarklundcom/moto` on latest `main`:

1. Create branch `review/<ID>-codex`.
2. Dispatch Codex, model `gpt-6-astra`, effort **high**, **review-only** (it writes one file and edits no code).
   Dispatch prompt:
   > Adversarial security review of the changes merged in PR <PR> (`git diff <merge-base>..<merge-commit>`), in
   > the context of `AGENTS.md` and `CLAUDE.md` §3–§4. Look for: authorization bypass (direct POST, wrong role,
   > missing row scope by `dealerId`/`ownerId`, admin routes without `requireRole`); token handling (manage and
   > draft tokens stored only hashed, constant-time compare, tokens in logs or referrers); upload validation
   > (content sniffing, SVG, size, EXIF, path traversal in `/media`); secrets reaching the client
   > (`VENDERCRM_API_KEY`, `SESSION_SECRET`, `CRON_SECRET`); CRM payload rules (no pipeline/stage/owner/tag,
   > empty optionals omitted, idempotency races); SQL built from user input; rate limits that trust
   > client-supplied IPs; anything invented shown to visitors. For each finding: file:line, severity
   > (critical/high/medium/low), a concrete exploit or failure scenario, and the minimal fix. Write the findings
   > to `docs/review/<ID>-codex.md`, nothing else. If you find nothing at a severity, say so explicitly.
3. Read the findings file yourself. Drop the ones you can disprove from the code (note why in the file).
4. Fix every critical/high and any cheap medium on the same branch (Codex worker or yourself), each with a test.
   `npm run verify` green (needs a local MySQL + `TEST_DATABASE_URL`; see `.env.example`).
5. Open PR `<ID> review: Codex findings`, merge when green. Anything you chose not to fix goes to
   `KNOWN-ISSUES.md` with the reason.

Never use Fable for this. Never run it inside a cloud build session.
