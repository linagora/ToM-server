# Contributing to Twake Identity Server

## Table of Contents

1. [Welcome](#1-welcome)
2. [Philosophy](#2-philosophy)
3. [Documentation Rules](#3-documentation-rules)
4. [Issues](#4-issues)
5. [Pull Requests](#5-pull-requests)
6. [Commits & Branches](#6-commits--branches)
7. [Using AI Tools](#7-using-ai-tools)

## 1. Welcome

Thank you for taking the time to contribute to Twake Identity Server. Every bug report, documentation fix, and pull request makes the project better for everyone who depends on it.

This guide explains how to work with the project effectively — how to report issues, open pull requests, write commits, and navigate the codebase. **Before writing any code, read [CODING_STYLE.md](./CODING_STYLE.md).** It is the authoritative reference for all style decisions and is not duplicated here.

If something in this guide is unclear or out of date, open a PR against it — the same process applies.

## 2. Philosophy

This codebase follows three principles. Every decision should be justified by at least one of them.

**Simplicity over cleverness.** If a junior developer can't understand the code in 30 seconds, it's too clever. No metaprogramming, no deep generics, no decorator magic. A `for` loop that's readable beats a chain of `.reduce().flatMap().filter()` that isn't.

**Explicit over implicit.** Dependencies are injected, not imported globally. Errors are typed, not caught-and-rethrown. Data flows are traceable through function signatures, not hidden behind event emitters or middleware side effects.

**Boundaries over conventions.** The module facade enforced by lint rules is better than a "please don't import internals" comment. A `#private` field is better than a naming convention. A TypeScript type is better than a JSDoc comment.

## 3. Documentation Rules

- All documentation — comments, commit messages, issues, pull requests, and docs files — must be written in **English**.
- Comments in code explain **why**, never **what**. The code explains what.
- Do not use `//` comments to disable code. Delete dead code. Git has history.
- If you change behaviour, update the relevant docs in the same PR. A PR that changes code without updating its documentation is incomplete.

## 4. Issues

### Before opening an issue

Search existing issues (open and closed) before filing a new one. If you find a match, add a reaction or a comment with additional context rather than opening a duplicate.

### Opening an issue

Use the appropriate [issue template](.github/ISSUE_TEMPLATE). Fill every field — sparse issues get closed or deprioritised. The template will guide you through what is needed depending on whether you are reporting a bug or proposing a feature.

A good issue:

- Has a **clear, specific title** (not "something is broken" or "idea").
- For bugs: includes **steps to reproduce**, **expected behaviour**, and **actual behaviour**.
- For features: describes the **use case** first, then the proposed solution.
- Mentions the **relevant package** (`package::identity-server`, `package::federation-server`, etc.) if known.

### Labels

Labels are applied by maintainers. You do not need to set them yourself, but understanding them helps you find the right issues to work on.

<details>
<summary><strong>Status</strong> — where an issue currently stands</summary>

| Label                | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `backlog`            | Not yet planned for doing.                                                                   |
| `blocked-externally` | Cannot progress because an external service or library we depend on has a bug or limitation. |
| `discussion`         | More discussion is required before classification or implementation can be started.          |
| `duplicate`          | This issue or pull request already exists.                                                   |
| `wontfix`            | Out of scope for the project, or cannot be done.                                             |

</details>

<details>
<summary><strong>Type</strong> — what kind of work the issue represents</summary>

| Label           | Description                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------- |
| `bug`           | Something does not behave as expected.                                                      |
| `chore`         | Modification that does not relate to a bug fix, a new feature, or a documentation update.   |
| `dependencies`  | Pull requests that update a dependency file.                                                |
| `deployment`    | Issues related to deployment, CI/CD, or other kinds of automation.                          |
| `documentation` | Documentation improvements or problems.                                                     |
| `feature`       | High-level feature/use-case description (implementation is split into multiple sub-issues). |
| `javascript`    | Pull requests that update JavaScript code.                                                  |
| `security`      | Security risk to users of the project.                                                      |

</details>

<details>
<summary><strong>Contribution difficulty</strong> — how much project knowledge is required</summary>

| Label                  | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `contribution::easy`   | Well explained and requires little project knowledge. Good first issue. |
| `contribution::medium` | Well explained, but requires some project knowledge.                    |
| `contribution::hard`   | Well explained, but requires a strong understanding of the project.     |

</details>

<details>
<summary><strong>Priority</strong> — how urgently the team wants this addressed</summary>

| Label              | Description                             |
| ------------------ | --------------------------------------- |
| `priority::urgent` | We want to do this as soon as possible. |
| `priority::high`   | We want to do this soon.                |
| `priority::normal` | Base priority (optional).               |
| `priority::low`    | Implementation is not time-sensitive.   |

</details>

<details>
<summary><strong>Severity</strong> — how badly a bug affects users (bugs only)</summary>

| Label                | Description                                         |
| -------------------- | --------------------------------------------------- |
| `severity::critical` | The entire project cannot be used.                  |
| `severity::major`    | Some important parts of the project cannot be used. |
| `severity::moderate` | Some parts of the project cannot be used.           |
| `severity::minor`    | Some parts of the project are inconvenient to use.  |
| `severity::cosmetic` | Usage is not impacted.                              |

</details>

<details>
<summary><strong>Package</strong> — which part of the monorepo is affected</summary>

| Label                        | Description                            |
| ---------------------------- | -------------------------------------- |
| `package::identity-server`   | Affects the identity server package.   |
| `package::federation-server` | Affects the federation server package. |
| `package::tom-server`        | Affects the TOM server package.        |
| `package::configuration`     | Anything related to the config-parser. |

</details>

## 5. Pull Requests

### Before opening a PR

- The issue you are fixing or the feature you are building should exist as an issue first. If it doesn't, open one and let it get triaged before investing time in a PR.
- Build packages locally first (fresh checkout): `npm run build`.
- Make sure all tests pass locally: `npm test`.
- Make sure the linter is clean: `npm run check`.

### Opening a PR

Use the [PR template](.github/pull_request_template.md). Link the issue it resolves with `Closes #<number>` in the description.

A good PR:

- Addresses **one concern**. A PR that fixes a bug, refactors unrelated code, and updates dependencies is three PRs.
- Has a **description that explains why**, not just what changed. Reviewers can read the diff; they can't read your reasoning.
- Keeps the scope as **small as reasonably possible**. Smaller PRs get reviewed faster and merged sooner.
- Updates **documentation** if behaviour changes.
- Does not introduce new `any` — warnings are existing tech debt, new ones are blockers.

### Review process

- At least one maintainer approval is required before merging.
- Address all review comments — either fix them or explain clearly why you disagree. If you disagree, use the PR thread, not a silent code change.

## 6. Commits & Branches

### Commit clear intentions

A commit is to be seen as an entry in a ledger. One can read it as "That day, That author, changed That part". Therefore we more than encourage our committers and contributers to commit as regularly as possible and to clearly identify their intents while doing so.

A commit deemed as good contains just what it needs to be meaningful ; if your intention is to update the retry logic of a database transaction just commit the changes around that call, if that were to depend on another layer of abstraction such as the Database Interface, commit the changes of the said Interface first.

This will allow you clearly decompose your modifications, enable smoother `git bisect` for troubleshooting, to better show your understanding of the changes and will allow everyone to carry on the modifications if needed.

In addition of a clear track of changes, using atomic commits also allows neat cherry-picking strategy if the branch one were working on needs a split or partial merging.

### Commit messages

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification via **[convco](https://convco.github.io/)**. All commit messages must be written in **English**.

```text
<type>(<scope>): <description>

[optional body — explain why, not what]

[optional footer — e.g. Closes #42, BREAKING CHANGE: ...]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

**Scope** is the module or package name: `addressbook`, `identity-server`, `kernel`, etc.

```text
feat(addressbook): add phonebook import endpoint
fix(user-info): respect admin field policy floor in public mode
refactor(identity): extract facade from monolithic service
test(access-control): add quarantine allowlist edge cases
docs: update contributing guide with PR process
```

Subject line rules: imperative mood ("add", not "added"), no trailing period, max 72 characters. The body is optional but encouraged for non-trivial changes — explain **why**.

### Signed commits

**Signed commits are strongly encouraged.** They verify that commits genuinely come from you and protect the project's integrity. To set up GPG signing:

```bash
# Generate a key if you don't have one
gpg --full-generate-key

# Find your key ID
gpg --list-secret-keys --keyid-format=long

# Tell git to use it (replace with your actual key ID)
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true
```

Then add your public key to your GitHub account under **Settings → SSH and GPG keys**. See [GitHub's signing guide](https://docs.github.com/en/authentication/managing-commit-signature-verification) for the full walkthrough.

### Branch naming

```text
<type>/<scope>/<short-description>

feat/addressbook/phonebook-import
fix/user-info/privacy-field-filtering
refactor/identity/facade-extraction
docs/contributing/pr-process
```

Branch names use **kebab-case** and mirror the commit type and scope.

_This guide is a living document. If a convention doesn't serve the project, challenge it in a PR — don't silently ignore it._

### 7. Using AI Tools

The rise of AI makes it easier than ever to ship code, and we are happy for you to use your preferred tools to boost your productivity. However, we want to ensure our codebase remains healthy and understandable.

We care deeply about the intent behind your changes. To ensure that every contributor truly understands their impact, we ask that:

- **You write your own descriptions**: Please fill out PR and Issue templates manually.
- **Humans do the talking**: We value your voice! Discussions and comments should be handled by you, not a bot.
- **You own the code**: It’s easy to "slam" a codebase with AI-generated snippets, but you must be able to justify why a change was made in a specific way.

*Note*: We use [CodeRabbit.ai](https://www.coderabbit.ai/) to help during code reviews. It remains available to help anyone and everyone meeting our expectations. Outside of this specific integration, please refrain from using AI to automate comments or replies.

Submissions that don't follow these guidelines may take longer for to review. If you're unsure about anything, just reach out! :)

Thank you again for joining the project,
See you soon in the Commits!
