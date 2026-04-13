# Milestone 175 - Data Sources Access Method Registry

## Status

Completed.

## Objective

Create a non-secret source-access method registry that makes local path, Git remote, GitHub/private repository, token/OAuth, password/session, certificate, SSH key, and manual-export requirements visible before app-development ingestion or multi-agent build work.

## Delivered

- Add `/api/sources/access-method-registry` with grouped access method records, source-level flags, setup guidance, and secret-handling policy.
- Extend source access profiles with non-secret local path, Git remote, GitHub remote, private repo, and manual-access signals.
- Surface the registry in the Sources view, Sources toolbar, and command palette.
- Add dashboard API/types, parser checks, server regression assertions, README notes, and TODO tracking.

## Validation

- `node --check` passed for the changed server, app, dashboard API, dashboard actions, dashboard views, dashboard types, parser, and server test modules.
- `npm test` passed all 6 tests, including access method registry API assertions.
- `node .\generate-audit.mjs` regenerated audit data across 75 detected projects.
- `node .\test-parse.js` reported Data sources access method registry as present after regeneration.
- `npm run build:vercel` completed the local static preview build without deploying to Vercel.
- Local app relaunched on `http://127.0.0.1:3042/` as PID `203804`; the page returned HTTP 200 and `/api/sources/access-method-registry` returned live registry data.
