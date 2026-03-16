<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .github/

## Purpose
GitHub Actions CI/CD pipeline definitions for the ToM-Server monorepo. Workflows handle building, testing, linting, security scanning, Docker image publishing, documentation deployment, and releases. Reusable workflow files (prefixed with `_`) are called from the main `ci.yml` orchestrator.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | All GitHub Actions workflow YAML files (see `workflows/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Workflows use a reusable pattern: `_build.yml`, `_test.yml`, etc. are called by `ci.yml`
- Workflow changes require a PR to `dev` branch (the main branch)
- Secrets (npm tokens, Docker credentials) are configured in GitHub repo settings, not here

<!-- MANUAL: -->
