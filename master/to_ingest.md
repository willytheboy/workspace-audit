# Master Ingest Index

This file tracks the source applications being reviewed for ingestion into the next-generation `workspace-audit` product.

## Target Families

- `AI / agent platform`
- `Platform / control center`

## Scope Guardrail

Only ingest donor apps that are themselves:

- app management tools
- app development tools
- app building / orchestration tools

Do not expand the ingest set into non-development product families, business vertical apps, or domain-specific end-user products.

## Candidate Applications

- `D:\Development\active\02_ai-agent-studio`
- `D:\Development\active\12_database-integration`
- `D:\Development\active\02_ai-agent-studio\patterns-from-project-creator`
- `D:\Development\archive\experiments\AI_team`
- `D:\Development\archive\experiments\AI_project_creator`
- `D:\Development\active\09_control-plane`
- `D:\Development\active\15_master-control`
- `D:\Development\CommandCore-Portable`
- `D:\Development\MasterControl`

## Intended Outputs

- Per-app architecture and feature profiles in `master/profiles/`
- Reusable parts analysis in `master/product_parts.md`
- Collected reusable implementation assets in `master/parts/`
- Product schematic, blueprint, and flow in `master/`
- Milestone logs in `master/milestones/`
