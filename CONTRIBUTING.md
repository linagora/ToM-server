# Developer's Guide

Thank you very much for joining the development effort!

As for any other open project we do appreciate any contribution whereas it is
code related or a tiny supporting text - as simple as ':)'.

Before continuing your reading, please have a look at our
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)!

## Language

Please mind that all of our documentation, code, discussion or any other written
production will be done and pursued in English. The use of another language is
**tolerated** for *documentation purposes only*, and in a
[dedicated folder only](#translated-documentation).

In other words, English **MUST** be used:

- To [describe an issue](#issue-tracking)
- To [suggest an enhancement](#issue-tracking)
- To [write documentation](#document-your-work)
- To name a `code` identifier - e.g. variable, function, Ansible job...
- To write any inline code documentation
- To discuss any MR/PR
- To communicate with other contributors

Another language **COULD** be used:

- To translate part/all documentation
  [in a properly structured folder](#translated-documentation)
- To complement your issue description with
  [a text in your native language](#provide-details-in-your-native-language)

Any produced text **MUST**:

- Follow the [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- Be clear
- Be concise
- (*English*) Have a good score on [Grammarly](https://www.grammarly.com) or
[Hemingway App](https://www.hemingwayapp.com/)

***Any piece of writing that does not follow this rule* WILL *be discarded or
ignored!***

## Issue tracking

If you want to contribute, but do not know what to improve, we recommend going
through to existing issues. We assign labels to issues to make them easier to
find.

> If you're reading this page in GitLab, the labels should appear in color and
> be clickable. If you're reading this on another tool, you can search by label
> in the issue list.

### Labels

<!-- markdownlint-disable-next-line MD033 -->
<details open=true> <summary>General</summary>

- ~Feature: High-level feature/use-case description (implementation is split
  into multiple sub-issues).
- ~Discussion: More discussion is required before classification or
  implementation can be started.
- ~Deployment: Issues related to deployment, CI/CD or other kinds of
  automation.
- ~Documentation: Documentation improvements or problems.
- ~Bug: Something does not behave as expected.
- ~Security: Security risk to users of the project.
- ~Incident: Deployment issue (the website is down…).
- ~Wontfix: We decided that this issue is out of scope for the project, or
  cannot be done.
- ~Blocked-externally: We cannot go further on this topic, because some
  external service/library we depend on has a bug/is missing a feature.

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>Contribution difficulty</summary>

These labels are indicators of how hard we think it is to implement them for an
external contributor. We do not always label issues by contribution difficulty.

If you are interested in an issue that isn't labelled, don't hesitate to write a
comment communicating your interest and asking for precision.

- ~Contribution::Easy: Issues that are well explained and require little
  project knowledge.
- ~Contribution::Medium: Issues that are well explained, but require some
  project knowledge.
- ~Contribution::Difficult: Issues that are well explained, but require a
  strong understanding of the project.

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>Priority</summary>

- ~Priority::low: Implementation is not time-sensitive.
- ~Priority::medium: Normal priority.
- ~Priority::high: We want to do this soon.
- ~Priority::urgent: We want to do this as soon as possible.

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>Severity (only for bugs and incidents)</summary>

- ~Severity::Cosmetic: Some parts of the project do not look as good as they
  could, or there is a minor error in documentation. Usage is not impacted.
- ~Severity::Minor: Some parts of the project are inconvenient to use.
- ~Severity::Moderate: Some parts of the project cannot be used.
- ~Severity::Major: Some important parts of the project cannot be used.
- ~Severity::Critical: The entire project cannot be used.

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>Development state (issues only)</summary>

We do not always use these labels. When in doubt, write a comment asking for
precision. These labels should only be applied to issues, not merge requests.

- ~Issue::Doing: Someone is currently working on it.
- ~Issue::Review: A merge request exists that will close this issue, and it's
  entered the review cycle.

</details>

### Provide details in your native language

As a multi-cultural team, we are aware that expressing yourself in a language
that is not fully yours might be a challenge. We thank you, a lot, in advance
for using English at first to embrace and encourage international collaboration.
But as sometimes this work might push you to simplify some ideas and/or part/all
of your description, we are encouraging you to also provide the original text in
a summary, as follow:

```md
Text in English...

<details> <summary>locale-CODE:</summary>

Native text...

</details>
```

The locale code **MUST** follow the
[standard form](https://simplelocalize.io/data/locales/).

#### Example: Native language description

The European languages are members of the same family. Their separate existence
is a myth. For science, music, sport, etc, Europe uses the same vocabulary. The
languages only differ in their grammar, their pronunciation and their most
common words. Everyone realizes why a new common language would be desirable:
one

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>fr-FR:</summary>

Les langues européennes sont membres d'une même famille. Leur existence séparée
est un mythe. Pour la science, la musique, le sport, etc., l'Europe utilise le
même vocabulaire. Les langues ne diffèrent que par leur grammaire, leur
prononciation et leurs mots les plus courants. Tout le monde comprend pourquoi
une nouvelle langue commune serait souhaitable : une seule

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>uk-UA:</summary>

Європейські мови є членами однієї родини. Їхнє окреме існування - це міф. У
науці, музиці, спорті тощо в Європі використовується однакова лексика. Мови
відрізняються лише граматикою, вимовою та найуживанішими словами. Кожен розуміє,
чому нова спільна мова була б бажаною: одна

</details>

<!-- markdownlint-disable-next-line MD033 -->
<details> <summary>Add as much as you'd like :)</summary>

...

</details>

## Committing

To keep a [`reflog`](https://git-scm.com/docs/git-reflog) as readable as
possible, we **REQUIRE** the use of
[Conventional Commits](https://www.conventionalcommits.org/).

Every commit that **DOES NOT** follow this convention **WILL** be discarded or
ignored.

Please read and get acquainted to the
[specifications](https://www.conventionalcommits.org/) **BEFORE** submitting
your first commits!

---

Also, being able to keep track of a precise modification history might *one day*
be more than useful. In that objective, we **REQUIRE** you to create
[atomic commits](https://medium.com/@krystalcampioni/advanced-git-guide-part-1-mastering-atomic-commits-and-enforcing-conventional-commits-1be401467a92)

---

**THE USE OF EMOJI AND OTHER SPECIAL CHARACTER IS STRICTLY FORBIDDEN!** Please
use ASCII alpha-numerical characters only. Punctuation is also allowed in the
commit message.

### Commit title

In addition of complying to the
[Conventional Commits](https://www.conventionalcommits.org/), your commit title
must be 72 characters long, **maximum**.

### Commit body

The commit body has a limit of 80 columns in width and **MUST** clearly detailed
what modifications it composed of.

In other words, it tells someone what applying that commit will do, so it
reads something like: 'If I apply this commit, it will make it do something...'

English is the **ONLY** language allowed!

### Commit footer

Those last lines, must be composed of a list of reference to the issue, or merge
request the commit relates to.

Finally, `signed-off` lines **SHOULD** be present to declare clearly who has
worked on these modifications.

## Signed Commits

Signed commits are strongly encouraged. They verify that commits genuinely come
from you and protect the project's integrity. To set up GPG signing:

```bash
# Generate a key if you don't have one
gpg --full-generate-key

# Find your key ID
gpg --list-secret-keys --keyid-format=long

# Tell git to use it (replace with your actual key ID)
git config --global user.signingkey ${YOUR_KEY_ID}
git config --global commit.gpgsign true
```

Then add your public key to your Git hosting provider.

## Versioning

Our project is versioned according to the
[Semantic Versioning](https://semver.org/) system. Please have a look to the
official website for more information :
[https://semver.org/](https://semver.org/)

All part of this project (if versioned independently) **MUST** follow the
[Semantic Versioning](https://semver.org/).

## Our workflow

*Final step before contributing to the project (For real)!*

In order to keep this repository 'clean' please follow these steps: (**Any work
pushed that does not comply with this workflow will be ignored!**)

1. Fork the project (to the namespace you find the most appropriate - personal
or a group)
2. Create a branch following the [naming convention](docs/Release.md#branch-naming)
3. Push your work onto that branch
4. Validate that your work is compliant to this guide
5. Create a 'Merge Request' onto the **`main`** branch!
6. Update your work until it gets accepted
7. Congratulation!

For the full release process (versioning, changelog, tagging), see
[RELEASE.md](docs/Release.md).

### Each task must be linked to an issue

Yes, you read it right!

We tend to keep our roadmap clear and open to external contributions. As such,
we **REQUIRE** that every task (fix, enhancement, documentation, etc.) to be
recorded in a dedicated issue.

This way, we will be able to add it to a Milestone and thus provide a clear
planning for all of us.

## Document your work

Documenting is as much important as writing the technical part of a project. If
your work is not understandable by others, it has 0 value.

As such, even if your write 'self-documenting' or 'self-understanding' code
(which we are sure you do), we require you to also provide literal documentation
along your work.

This could take the form of a dedicated `.md` page or an 'inline' summary thanks
to code comments. ***Though, both* ARE NOT *serving the same usage!*** So please
read the following **thoroughly**.

### Documentation folder

The [documentation folder](docs/) is there to hold meta or macro pieces of
documentation ; e.g. 'Users Documentation', 'wiki', examples, additional
informations, 'ADR', etc.

At its root a [`README.md`](docs/README.md) **MUST** be present and **MUST**
contain links to other parts of the folder or useful resources.

Other files **MUST** be named according to their purpose - i.e. representing the
type of provided information.

All documents **MUST** be written following the Markdown `.md` format:

- [https://datatracker.ietf.org/doc/html/rfc7763](https://datatracker.ietf.org/doc/html/rfc7763)
- [https://commonmark.org/](https://commonmark.org/)
- [http://spec.commonmark.org/](http://spec.commonmark.org/)

Any other derivatives of this standard is **NOT ALLOWED** under the scope of
that folder.

**ALL** markdown files **MUST** be 80 columns wide!

If you wish to use other formats, please create a dedicated folder named after
the format used - e.g. `docs/html`, `docs/txt`, `docs/adoc`. This folder **MUST**
contains the according 'default' page at its root - e.g. `docs/html/index.html`.

It is **FORBIDDEN** to write documentation in another format **ONLY**. Each
pages under `docs/<format>` **MUST** have its markdown equivalent.

### 'Inline' documentation

By 'inline documentation' we refer to: any code comments that provide
information about the code logic **following** it.

Hence, these comments **MUST** be placed **BEFORE** the code it provides
information about.

They **MUST** be at least 1 sentence long (starting with a Capital letter and
finish with a '.').

It is **NOT MANDATORY** to provide such comments for **all** your functions or
scoped code (e.g. `for` loop, `if` statement...), but is highly **RECOMMENDED**
for each 'complex' logic code.

***The comments* MUST *follow the coding style of the project!*** Otherwise,
your entire code could be discarded or ignored.

### Translated documentation

If you speak another language than English we will be pleased if you help us
translating part of our documentation.

A translated file **MUST** be placed under the according folder, following the
ISO locale code - e.g. `docs/fr-FR` for French from France, `docs/ar-TN` for
Arabic from Tunisia...

The list of ISO codes can be found
[here: https://simplelocalize.io/data/locales/](https://simplelocalize.io/data/locales/)
.

## Using AI Tools

The rise of AI makes it easier than ever to ship code, and we are happy for you
to use your preferred tools to boost your productivity. However, we want to
ensure our codebase remains healthy and understandable.

We care deeply about the intent behind your changes. To ensure that every
contributor truly understands their impact, we ask that:

- You write your own descriptions: Please fill out PR and Issue templates
  manually.
- Humans do the talking: We value your voice! Discussions and comments should
  be handled by you, not a bot.
- You own the code: It’s easy to "slam" a codebase with AI-generated snippets,
  but you must be able to justify why a change was made in a specific way.

---

## Final words

First of all: Thank you very much for reading this document until the end!

Please be assured that this document **will** evolve considering your feedbacks
and hopefully with your help :)

If during a review part of your work is rejected, *don't panic* we will help you
meet our requirements and standards. Our goal is not to refrain you from
contributing or helping, but to keep a project visually uniform and clear for
anyone to jump-in.

Feel free to help us enhance our guidelines and make them even better!

Finally, mind that this document remains a set of guidelines and that we are
human enough to adapt to each situation :D

<!-- vim: set ft=markdown fenc=utf-8 spell spl=en tw=80 cc=80 et ts=2: -->
