# Milestone 221 - Release Build Gate Local Evidence Checkpoints

Status: Completed
Completed: 2026-04-13

## Outcome

- Added Governance Release Control `Confirm Local Evidence` and `Defer Local Evidence` controls beside the existing local evidence bootstrap action.
- Reused the non-secret release checkpoint ledger to persist operator decisions about local smoke/bootstrap evidence.
- Added `Track Evidence Task` so local release evidence can become a Release Control task with task-ledger auto-capture.
- Added parser coverage for local evidence checkpoint controls and task conversion.

## Non-Secret Policy

- Local evidence checkpoints store release status, gate decision, risk score, smoke status, smoke counts, and Git commit metadata only.
- Local evidence task conversion stores only non-secret release evidence metadata and never stores response bodies, credentials, provider tokens, cookies, certificates, private keys, browser sessions, or command output.

## Validation

- `node --check ui\dashboard-components.js`
- `node --check ui\dashboard-views.js`
- `node --check test-parse.js`
- `node test-parse.js | Select-String -Pattern "Release build gate local evidence checkpoints|: Missing"` returned `Present` and no missing checks.
- `npm test` passed all 8 suites.
- `npm run build:vercel` completed and wrote the static preview to `public`.
- `git diff --check` passed.
- Relaunched the local app on `http://127.0.0.1:3042/`.
- Smoke-checked `/`, `/api/releases/build-gate`, and served dashboard assets after relaunch.

## Next Candidate

- Add Release Control saved checkpoint ledger checkpoints so saved release checkpoint rows can be confirmed, deferred, or converted into Release Control tasks without storing response bodies or secrets.
