# Release Process

## Branch Naming

All PRs must be created on dedicated branches following the
[conventional commits](https://www.conventionalcommits.org/) scope pattern:

| Type       | Branch prefix    | Example                          |
| ---------- | ---------------- | -------------------------------- |
| Bug fix    | `fix/`           | `fix/42-missing-reconnect`       |
| Feature    | `feat/`          | `feat/38-rabbitmq-tls`           |
| Refactor   | `refactor/`      | `refactor/50-config-cleanup`     |
| Docs       | `docs/`          | `docs/15-update-readme`          |
| Chore      | `chore/`         | `chore/30-bump-deps`             |
| CI/CD      | `ci/`            | `ci/44-github-actions`           |
| Test       | `test/`          | `test/39-bridge-unit-tests`      |

The branch prefix mirrors the commit type so the PR history stays clean and
consistent with conventional commits.

## Workflow

1. **Create a branch** from `main` using the naming convention above.

   ```bash
   git checkout main && git pull
   git checkout -b fix/42-missing-reconnect
   ```

2. **Develop and commit** using conventional commits
   (the `convco-commit` git hook will help):

   ```bash
   git commit    # interactive conventional-commit prompt
   ```

3. **Open a PR** targeting `main`. Ensure CI passes and the PR is reviewed.

4. **Merge** the PR into `main` (squash-merge recommended).

## Releasing

Releases are performed **on `main`** after all desired PRs have been merged.

```bash
git checkout main && git pull

# Auto-detect version bump from conventional commits:
_twp_release

# Or force a specific bump level:
_twp_release --patch
_twp_release --minor
_twp_release --major
```

The script will:

1. Verify the working tree is clean.
2. Compute the next version via `convco version --bump`.
3. Update `package.json` with the new version.
4. Generate `CHANGELOG.md`.
5. Create a release commit (`chore(release): vX.Y.Z`) and annotated tag.

## Pushing

After reviewing the commit and tag locally:

```bash
git push && git push --tags
```
