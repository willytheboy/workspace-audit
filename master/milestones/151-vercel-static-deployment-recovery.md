# 151 - Vercel Static Deployment Recovery

Status: Complete.

## Scope

- Investigated the reported Vercel `FUNCTION_INVOCATION_FAILED` production error.
- Confirmed the latest deployment from `ebc40ad` still produced a Node serverless deployment because the Vercel project framework preset was `node`.
- Added a repo-level Vercel framework override so Git deployments use the static `Other` preset while keeping the local `npm run dev` server unchanged.

## Validation

- `npm run build:vercel`
- Vercel deployment `dpl_DkXoShRHiZ9dqTKWf9D4PKF1JG3J` reached `READY`.
- Build logs show `Static Vercel preview written to /vercel/path0/public`.
- `https://workspace-audit-oz41yv610-wabunassar-gmailcoms-projects.vercel.app/` returned HTTP 200.
- `https://workspace-audit-tau.vercel.app/` returned HTTP 200.
- `https://workspace-audit-wabunassar-gmailcoms-projects.vercel.app/` returned HTTP 200.
- `https://workspace-audit-git-main-wabunassar-gmailcoms-projects.vercel.app/` returned HTTP 200.

## Notes

- GitHub checkpoint pushed: `9a043da Force Vercel static framework preset`.
- Vercel deployment is a static monitoring preview. The live filesystem-backed control plane remains local at `http://localhost:3042`.
