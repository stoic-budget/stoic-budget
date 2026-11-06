---
title: Coding Standards
description: TypeScript conventions and formatting
---

Stoic Budget uses Biome for linting and formatting in both apps; frontend SCSS is checked with stylelint. Follow the conventions of the surrounding code.

## Language and formatting

- TypeScript everywhere
- Biome formatting: 2 spaces, single quotes, semicolons, 100-character lines
- Prefer `const` (`useConst` is an error)
- Avoid `any` (`noExplicitAny` warns)
- Keep functions small and focused
- Use async/await instead of callbacks
- Add JSDoc comments for public APIs
- Use interfaces for object shapes, and export types that are used across modules
- Code comments and commit messages in English

## Naming conventions

- `camelCase` for variables and functions
- `PascalCase` for classes, types, and React component files (for example `AppChrome.tsx`)
- `kebab-case` for other files (for example `password-reset.service.ts`)
- `UPPER_SNAKE_CASE` for constants
- Prefix interfaces with `I` only when necessary, and use descriptive names rather than abbreviations

Biome does not enforce naming (`useNamingConvention` is off), so match the files next to yours.

## Lint and format

```bash
npm --prefix backend run lint:check
npm --prefix frontend run lint:check
npm --prefix backend run lint:fix
npm --prefix frontend run lint:fix
make format
```

## Backend rules

- Every tenant-owned query filters by `workspaceId`
- Keep controllers thin: logic in services, input validation in DTOs
- Schema changes only through migrations
- `file_hash` (SHA-256) for idempotent file operations
- Structured JSON logging with correlation IDs

## Code review expectations

- Ensure tests cover new behavior
- Document any breaking changes
- Add migration notes for schema updates

## Documentation

- Use Markdown, with code examples where applicable
- Keep line length under 100 characters
- Use descriptive link text (not "click here") and proper heading hierarchy (h1 → h2 → h3)
- Add a table of contents to long documents
- Update the relevant docs when changing functionality
- Explain both "what" and "why"

Next: [Adding a Bank Parser](adding-a-bank-parser)
