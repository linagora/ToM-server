## What

<!-- A concise description of what this PR changes. One paragraph is enough. -->

## Why

<!-- Why is this change needed? Link the issue it addresses. -->

Closes #

## How

<!-- Non-obvious implementation decisions, trade-offs, or anything a reviewer should know before reading the diff. Skip if the why + diff are self-explanatory. -->

## Checklist

### Code
- [ ] Tests pass (`npm test`)
- [ ] Linter is clean (`npm run check`)
- [ ] No new `any` introduced
- [ ] No dead code or commented-out blocks
- [ ] All other style rules per [CODING_STYLE.md](../CODING_STYLE.md)

### Scope
- [ ] This PR addresses one concern (not a mix of bug fixes, refactors, and features)
- [ ] Cross-module changes are documented in the description

### Documentation
- [ ] Inline comments explain *why*, not *what*
- [ ] Relevant docs updated if behaviour changed

### Tests
- [ ] New behaviour is covered by tests
- [ ] If a new endpoint was added: handler integration test included
- [ ] If a new service method was added: unit test with stubbed repo included

### Git
- [ ] Commits follow [convco / Conventional Commits](https://convco.github.io/)
- [ ] Commits are signed (strongly encouraged — see [CONTRIBUTING.md §6](../CONTRIBUTING.md#6-commits--branches))
- [ ] Branch name follows `<type>/<scope>/<description>` convention
