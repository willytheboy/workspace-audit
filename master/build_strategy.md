# Build Strategy

## Levels

## Level 1: Control Surface

Target:

- command palette
- action registry
- keyboard-first navigation

Outcome:

- app behaves like a control center, not just a report

## Level 2: Source Onboarding

Target:

- setup modal
- source connection states
- project-ready completion state

Outcome:

- source tracking becomes guided and operational

## Level 3: Durable Data Layer

Target:

- SQLite persistence for projects, scans, sources, findings, tasks, workflows

Outcome:

- history, diffing, and memory stop depending on generated snapshots alone

## Level 4: Project Workbench

Target:

- launchpad detail panel
- notes, todos, milestones, sessions
- launcher hooks

Outcome:

- project detail view becomes a usable workspace

## Level 5: Workflow And Agent Layer

Target:

- workflow engine UI
- workflow persistence
- supervised build/review loops

Outcome:

- AI / agent platform capability lands without destabilizing the current product

## Level 6: Autonomous App-Building Control Plane

Target:

- multi-agent build lanes
- multi-skill routing
- source access coverage gates
- governance-to-agent decision payloads
- work-order execution and validation loops

Outcome:

- app-development goals can be converted into supervised, evidence-backed agent build passes without bypassing source access, governance, or validation gates

## Layers

- Presentation layer
- Action / command layer
- Domain services layer
- Persistence layer
- Integration layer

## Achievable Near-Term Targets

- Add command palette
- Add setup modal
- Add settings shell
- Add persistent sources + findings tables
- Replace modal-only app detail with a workbench drawer

## Sequence Rule

Always prefer:

1. low-coupling control-center feature
2. durable persistence improvement
3. workbench/detail upgrade
4. workflow/agent capability
5. autonomous control-plane capability

Do not invert this order.

## Current Phase Status

The current consolidation phase is complete.

Completed in this phase:

- donor discovery and profile creation for the development-tool scope
- reusable-parts extraction and blueprint definition
- control-center, persistence, workbench, governance, and action-queue implementation
- validation, relaunch, and live monitoring support

The next phase should only extend the software-development control loop. Do not reopen donor discovery for non-development apps.
