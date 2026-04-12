# Database Integration

## Identity

- Source path: `D:\Development\active\12_database-integration`
- Product intent: enterprise intelligence and migration platform that moves data from legacy systems into normalized pipelines with audit, compliance, and AI-assisted operations.
- Maturity: focused domain platform rather than a general control center.

## Architecture

- Orchestrator: TypeScript / Express service in `orchestrator/src/index.ts`
- ETL and staging layers: `etl-worker`, `database`, `staging`
- Discovery scripts: Python schema and column inspection scripts in `scripts/`
- UI: separate `ui/` package for operational visibility

## Strongest Features

- Audit/logging route discipline in `orchestrator/src/index.ts`
- Compliance, lineage, and quarantine endpoint concepts
- Schema discovery and probing scripts:
  - `scripts/discover_columns.py`
  - `scripts/get_all_schemas.py`
  - `scripts/parse_schema.py`
  - `scripts/probe_tables.py`

## Best Reusable Parts

- Route design patterns for ingestion pipelines and audit events
- Schema discovery scripts as ingestion analyzers
- Health / stats endpoints as monitoring primitives

## Best Concepts

- Treat ingestion as a governed pipeline with audit trails.
- Surface lineage, compliance, and quarantine states explicitly.
- Keep discovery scripts separate from orchestrator runtime.

## Integration Value

- Backend route-pattern donor: medium-high
- Script donor: high for ingestion/discovery features
- UI donor: low-medium

## Risks

- Much of the system is enterprise data-domain specific and should be adapted, not copied.
- It is better as a pattern source for source-ingestion and lineage, not as a whole-product template.
