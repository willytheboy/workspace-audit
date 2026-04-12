# Project Schematic

## Level 1: Shell

- dashboard shell
- command palette
- modal / drawer system
- routing or view-state controller

## Level 2: Domain Surfaces

- portfolio inventory
- source onboarding
- project workbench
- workflow console
- settings and diagnostics

## Level 3: Core Services

- scan engine
- source registry
- findings engine
- workflow service
- task service
- memory service
- launcher service

## Level 4: Persistence

- scans
- project records
- source records
- findings
- workflow runs
- tasks
- notes / decisions / milestones

## Level 5: Integrations

- local folders
- GitHub
- Vercel
- Supabase
- later: other AI and infra sources

## Immediate Structural Direction

- keep the current scan engine
- add a thin action layer on top
- then add persistence and onboarding
- then replace modal-only detail views with a proper project workbench
