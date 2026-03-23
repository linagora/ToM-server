<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-16 | Updated: 2026-03-16 -->

# docs/

## Purpose
Static API documentation served as a Swagger UI single-page application. Contains the HTML/JS/CSS assets for the Swagger UI viewer and the OpenAPI specification files that describe the ToM-Server REST API endpoints. This directory is deployed as a static site (e.g., GitHub Pages) via the `_docs.yml` CI workflow.

## For AI Agents

### Working In This Directory
- Do NOT manually edit generated assets (swagger-ui JS/CSS bundles)
- OpenAPI spec files (`.yaml`/`.json`) describe the API — keep them in sync with route implementations in `packages/tom-server/src/`
- Documentation is deployed automatically via CI on pushes to `dev`

### Testing Requirements
Open `docs/index.html` in a browser to preview the Swagger UI locally.

<!-- MANUAL: -->
