# Milestone 487 - Scoped CLI Contract Preview

An operator can open **Preview CLI contract** on an active work order in **Governance > Agent Execution Queue** and see the live decision for Codex or Claude.

- [x] Show the selected project, working folder, validation commands, and readiness checks from the existing dry-run API.
- [x] Copy the handoff when the selected run matches the current scope and the server reports Ready.
- [x] Add the preview step to the operating guide and record the supervised pilot criteria in app memory.
- [x] Pass `node --test tests/cli-contract-preview.test.mjs`, the main test suite, parser checks, and the static build. The preview tests use both runners against a fixture server and cover ready copies, fallback rejection, and scope changes.
- [x] Relaunch on port `3042` and confirm the dashboard, inventory, Governance API, and preview module respond.

Live Governance reports `hold`. Both queued runs reference projects missing from the current inventory. The live pilot remains open in the master TODO list. Work settings disabled browser automation, so UI behavior was checked through the automated fixture tests.
