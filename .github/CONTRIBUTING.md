# Contributing to Stoic Budget

First off, thank you for considering contributing to Stoic Budget! It's people like you that make Stoic Budget such a great tool.

This page covers how to report a problem and how to open a pull request. Setup, tests and standards live on the [documentation site](https://stoic-budget.github.io/stoic-budget/), so there is one copy of them:

| Page | What it covers |
|---|---|
| [Quick Start](https://stoic-budget.github.io/stoic-budget/docs/getting-started/quick-start) | Every way to start the stack |
| [Local Development](https://stoic-budget.github.io/stoic-budget/docs/getting-started/local-development) | Running the apps on your host, troubleshooting |
| [Development Workflow](https://stoic-budget.github.io/stoic-budget/docs/contributing/development-workflow) | Branches, commit messages, CI, adding a feature |
| [Testing](https://stoic-budget.github.io/stoic-budget/docs/contributing/testing) | Running and writing tests |
| [Coding Standards](https://stoic-budget.github.io/stoic-budget/docs/contributing/coding-standards) | TypeScript, naming, linting, documentation style |
| [Adding a Bank Parser](https://stoic-budget.github.io/stoic-budget/docs/contributing/adding-a-bank-parser) | Supporting a new bank |
| [Architecture Overview](https://stoic-budget.github.io/stoic-budget/docs/architecture/overview) | Services, request flow, repository layout |

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior through GitHub issues.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Use the bug report template** which includes:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: OS, Node version, Docker version, browser
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or logs

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

**Use the feature request template** which includes:

- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: How would you like it to work?
- **Alternatives Considered**: What other solutions did you consider?
- **Additional Context**: Mockups, examples, or other context

### Your First Code Contribution

Unsure where to begin? You can start by looking through these issues:

- **good first issue** - Issues that should only require a few lines of code
- **help wanted** - Issues that are a bit more involved
- **documentation** - Help improve our docs

### Pull Requests

The process described here has several goals:

- Maintain Stoic Budget's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible Stoic Budget
- Enable a sustainable system for maintainers to review contributions

**Before submitting a pull request:**

1. **Fork the repository** and create your branch from `main`
2. **Set up the project** (see [Development Setup](#development-setup))
3. **Make your changes** and ensure they work
4. **Add tests** if you've added code that should be tested
5. **Update documentation** if you've changed APIs or added features
6. **Ensure the test suite passes** (`npm test` at the root runs the backend and frontend Vitest suites)
7. **Make sure your code lints and type-checks** (`npm --prefix backend run lint:check`, `npm --prefix frontend run lint:check`, `npm --prefix backend run typecheck`, `npm --prefix frontend run type-check`)
8. **Format your code** (`make format`)
9. **Write commit messages** as [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(auth): correct JWT token expiration handling`; commitlint checks them in the `commit-msg` hook

**Pull Request Guidelines:**

- Use a clear and descriptive title
- Follow the pull request template, including the "How to accept" steps for a change people can see
- Link related issues (e.g., "Fixes #123")
- Include screenshots/GIFs for UI changes
- Keep PRs focused on a single concern
- Respond to review feedback promptly

How a pull request is reviewed and accepted, and which labels it needs, is in
[Reviewing changes](https://stoic-budget.github.io/stoic-budget/docs/contributing/reviewing).

## Development Setup

You need Node.js 22.18+, npm, Git and Docker with Compose v2.

```bash
git clone https://github.com/YOUR_USERNAME/stoic-budget.git
cd stoic-budget
npm run setup:dev:docker   # or: make quick-dev
```

Open http://localhost:3000 and login with `demo@seneca.dev` / `demo123`.

To run without Docker, or to run the apps on your host, see [Local Development](https://stoic-budget.github.io/stoic-budget/docs/getting-started/local-development).

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Use the bug report template
- **Feature requests**: Use the feature request template
- **Security issues**: See [SECURITY.md](SECURITY.md)

## Recognition

Contributors are recognized in:
- Release notes
- GitHub contributors page
- Special mentions for significant contributions

Thank you for contributing to Stoic Budget! 🎉
