<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# .github/workflows/

## Purpose
GitHub Actions CI/CD workflow definitions. Uses a reusable workflow pattern where `ci.yml` orchestrates calls to specialized reusable workflows (prefixed with `_`). Covers build validation, testing, linting, security scanning, Docker publishing, documentation deployment, and releases.

## Key Files

| File | Description |
|------|-------------|
| `ci.yml` | Main CI orchestrator — triggers on PR and push, calls reusable workflows |
| `release.yml` | Release workflow — publishes npm packages and Docker images on tags |
| `security-scheduled.yml` | Scheduled security scan (runs on cron schedule) |
| `_build.yml` | Reusable: runs `npm build` and validates compilation |
| `_test.yml` | Reusable: runs `npm test` with coverage |
| `_test-ci.yml` | Reusable: CI-optimized test run (with caching) |
| `_lint.yml` | Reusable: runs Biome checks |
| `_security.yml` | Reusable: njsscan + dependency audit |
| `_docker-publish.yml` | Reusable: builds and pushes Docker image to registry |
| `_docs.yml` | Reusable: deploys Swagger docs to GitHub Pages |

## For AI Agents

### Working In This Directory
- All reusable workflows start with `_` — call them from `ci.yml` via `uses: ./.github/workflows/_xxx.yml`
- Secrets referenced: `NPM_TOKEN`, `DOCKER_USERNAME`, `DOCKER_PASSWORD`, `GITHUB_TOKEN`
- Node.js version is pinned via `.node-version` file at the repo root

<!-- MANUAL: -->
